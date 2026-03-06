import { z } from 'zod';
import { CanonicalRate, MealPlan } from '../types/rate.canonical';
import { calcConfidence, generateId, logger, pickLocalised, toInt } from '../utils';

const MewsRateSchema = z.object({
  Id: z.string(),
  ServiceId: z.string().optional(),
  SpaceTypeCategoryId: z.string().optional(),
  Name: z.record(z.string(), z.string()).optional(),
  ShortName: z.record(z.string(), z.string()).optional(),
  Description: z.record(z.string(), z.string()).optional(),
  IsActive: z.boolean().optional(),
  IsPublic: z.boolean().optional(),
  Currency: z.string().optional(),
  BaseAmount: z.number().optional(),
  MinimumNights: z.number().optional(),
  MaximumNights: z.number().optional(),
  CancellationPolicy: z.string().optional(),
  MealType: z.string().optional(),
  IsRefundable: z.boolean().optional(),
  MinAdvance: z.number().optional(),
  MaxAdvance: z.number().optional(),
}).passthrough();

const MewsRateResponseSchema = z.object({
  rates: z.array(z.unknown()),
}).passthrough();

const MEAL_MAP: Record<string, MealPlan> = {
  None: 'none',
  Breakfast: 'breakfast',
  HalfBoard: 'half_board',
  FullBoard: 'full_board',
  AllInclusive: 'all_inclusive',
};

const TOTAL = 10;

function parseRate(raw: unknown): CanonicalRate | null {
  const r = MewsRateSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Mews: failed to parse rate', r.error.flatten());
    return null;
  }
  const rate = r.data;
  let populated = 0;
  const name = pickLocalised(rate.Name); if (name) populated++;
  const code = pickLocalised(rate.ShortName); if (code) populated++;
  const description = pickLocalised(rate.Description); if (description) populated++;
  if (rate.Currency) populated++;
  if (rate.BaseAmount != null) populated++;
  if (rate.MinimumNights != null) populated++;
  if (rate.CancellationPolicy) populated++;
  if (rate.MealType) populated++;
  if (rate.IsActive != null) populated++;
  if (rate.IsRefundable != null) populated++;

  return {
    id: generateId('mews'),
    externalId: rate.Id,
    pmsSource: 'mews',
    propertyExternalId: rate.ServiceId ?? '',
    roomTypeExternalId: rate.SpaceTypeCategoryId ?? '',
    name,
    code,
    description,
    currency: rate.Currency ?? '',
    basePrice: rate.BaseAmount ?? 0,
    minStay: toInt(rate.MinimumNights),
    maxStay: toInt(rate.MaximumNights),
    isActive: rate.IsActive ?? true,
    cancellationPolicy: rate.CancellationPolicy ?? '',
    mealPlan: MEAL_MAP[rate.MealType ?? ''] ?? 'none',
    isRefundable: rate.IsRefundable ?? true,
    advanceBookingMin: toInt(rate.MinAdvance),
    advanceBookingMax: toInt(rate.MaxAdvance),
    confidence: calcConfidence(populated, TOTAL),
    rawData: rate as Record<string, unknown>,
  };
}

export function parseRates(rawApiResponse: unknown): CanonicalRate[] {
  const top = MewsRateResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
    logger.error('Mews: unexpected rate response shape', top.error.flatten());
    return [];
  }
  return top.data.rates.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
}
