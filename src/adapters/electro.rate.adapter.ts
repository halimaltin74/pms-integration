import { z } from 'zod';
import { CanonicalRate, MealPlan } from '../types/rate.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const ElectroRateSchema = z.object({
  id: z.union([z.string(), z.number()]),
  propertyId: z.union([z.string(), z.number()]).optional(),
  roomTypeId: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  basePrice: z.union([z.string(), z.number()]).optional(),
  minStay: z.union([z.string(), z.number()]).optional(),
  maxStay: z.union([z.string(), z.number()]).optional(),
  active: z.union([z.boolean(), z.number()]).optional(),
  mealPlan: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  isRefundable: z.union([z.boolean(), z.number()]).optional(),
  advanceBookingMin: z.union([z.string(), z.number()]).optional(),
  advanceBookingMax: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const ElectroRateResponseSchema = z.object({
  rates: z.array(z.unknown()),
}).passthrough();

const MEAL_MAP: Record<string, MealPlan> = {
  none: 'none',
  breakfast: 'breakfast',
  half_board: 'half_board',
  full_board: 'full_board',
  all_inclusive: 'all_inclusive',
};

const TOTAL = 9;

function parseRate(raw: unknown): CanonicalRate | null {
  const r = ElectroRateSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Electro: failed to parse rate', r.error.flatten());
    return null;
  }
  const rate = r.data;
  let populated = 0;
  if (rate.name) populated++;
  if (rate.code) populated++;
  if (rate.description) populated++;
  if (rate.currency) populated++;
  if (rate.basePrice != null) populated++;
  if (rate.minStay != null) populated++;
  if (rate.cancellationPolicy) populated++;
  if (rate.mealPlan) populated++;
  if (rate.active != null) populated++;

  return {
    id: generateId('electro'),
    externalId: String(rate.id),
    pmsSource: 'electro',
    propertyExternalId: String(rate.propertyId ?? ''),
    roomTypeExternalId: String(rate.roomTypeId ?? ''),
    name: rate.name ?? '',
    code: rate.code ?? '',
    description: rate.description ?? '',
    currency: rate.currency ?? '',
    basePrice: Number(rate.basePrice ?? 0),
    minStay: toInt(rate.minStay),
    maxStay: toInt(rate.maxStay),
    isActive: rate.active !== false && rate.active !== 0,
    cancellationPolicy: rate.cancellationPolicy ?? '',
    mealPlan: MEAL_MAP[(rate.mealPlan ?? '').toLowerCase()] ?? 'none',
    isRefundable: rate.isRefundable !== false && rate.isRefundable !== 0,
    advanceBookingMin: toInt(rate.advanceBookingMin),
    advanceBookingMax: toInt(rate.advanceBookingMax),
    confidence: calcConfidence(populated, TOTAL),
    rawData: rate as Record<string, unknown>,
  };
}

export function parseRates(rawApiResponse: unknown): CanonicalRate[] {
  const top = ElectroRateResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
    logger.error('Electro: unexpected rate response shape', top.error.flatten());
    return [];
  }
  return top.data.rates.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
}
