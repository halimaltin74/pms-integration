import { z } from 'zod';
import { CanonicalRate, MealPlan } from '../types/rate.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const CloudbedsRatePlanSchema = z.object({
  ratePlanID: z.union([z.string(), z.number()]),
  propertyID: z.union([z.string(), z.number()]).optional(),
  roomTypeID: z.union([z.string(), z.number()]).optional(),
  ratePlanName: z.string().optional(),
  ratePlanShortName: z.string().optional(),
  ratePlanDescription: z.string().optional(),
  currency: z.string().optional(),
  defaultPrice: z.union([z.string(), z.number()]).optional(),
  minStay: z.union([z.string(), z.number()]).optional(),
  maxStay: z.union([z.string(), z.number()]).optional(),
  isActive: z.union([z.boolean(), z.number(), z.string()]).optional(),
  mealType: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  isRefundable: z.union([z.boolean(), z.number()]).optional(),
  minAdvance: z.union([z.string(), z.number()]).optional(),
  maxAdvance: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const CloudbedsRateResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
}).passthrough();

const MEAL_MAP: Record<string, MealPlan> = {
  none: 'none',
  breakfast: 'breakfast',
  'half board': 'half_board',
  halfboard: 'half_board',
  'full board': 'full_board',
  fullboard: 'full_board',
  'all inclusive': 'all_inclusive',
  allinclusive: 'all_inclusive',
};

function coerceBool(v: unknown, fallback = true): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

const TOTAL = 9;

function parseRate(raw: unknown): CanonicalRate | null {
  const r = CloudbedsRatePlanSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Cloudbeds: failed to parse rate plan', r.error.flatten());
    return null;
  }
  const rate = r.data;
  let populated = 0;
  if (rate.ratePlanName) populated++;
  if (rate.ratePlanShortName) populated++;
  if (rate.ratePlanDescription) populated++;
  if (rate.currency) populated++;
  if (rate.defaultPrice != null) populated++;
  if (rate.minStay != null) populated++;
  if (rate.cancellationPolicy) populated++;
  if (rate.mealType) populated++;
  if (rate.isActive != null) populated++;

  return {
    id: generateId('cloudbeds'),
    externalId: String(rate.ratePlanID),
    pmsSource: 'cloudbeds',
    propertyExternalId: String(rate.propertyID ?? ''),
    roomTypeExternalId: String(rate.roomTypeID ?? ''),
    name: rate.ratePlanName ?? '',
    code: rate.ratePlanShortName ?? '',
    description: rate.ratePlanDescription ?? '',
    currency: rate.currency ?? '',
    basePrice: Number(rate.defaultPrice ?? 0),
    minStay: toInt(rate.minStay),
    maxStay: toInt(rate.maxStay),
    isActive: coerceBool(rate.isActive),
    cancellationPolicy: rate.cancellationPolicy ?? '',
    mealPlan: MEAL_MAP[(rate.mealType ?? '').toLowerCase()] ?? 'none',
    isRefundable: coerceBool(rate.isRefundable),
    advanceBookingMin: toInt(rate.minAdvance),
    advanceBookingMax: toInt(rate.maxAdvance),
    confidence: calcConfidence(populated, TOTAL),
    rawData: rate as Record<string, unknown>,
  };
}

export function parseRates(rawApiResponse: unknown): CanonicalRate[] {
  const top = CloudbedsRateResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected rate response shape', top.error.flatten());
    return [];
  }
  return top.data.data.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
}
