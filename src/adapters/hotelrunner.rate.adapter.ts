import { z } from 'zod';
import { CanonicalRate, MealPlan } from '../types/rate.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const HRRatePlanSchema = z.object({
  rate_plan_id: z.union([z.string(), z.number()]),
  property_id: z.union([z.string(), z.number()]).optional(),
  room_type_id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  short_name: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  base_price: z.union([z.string(), z.number()]).optional(),
  min_stay: z.union([z.string(), z.number()]).optional(),
  max_stay: z.union([z.string(), z.number()]).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  meal_plan: z.string().optional(),
  cancellation_policy: z.string().optional(),
  is_refundable: z.union([z.boolean(), z.number()]).optional(),
  min_advance: z.union([z.string(), z.number()]).optional(),
  max_advance: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const HRRateResponseSchema = z.object({
  data: z.object({ rate_plans: z.array(z.unknown()) }),
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
  const r = HRRatePlanSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('HotelRunner: failed to parse rate_plan', r.error.flatten());
    return null;
  }
  const rate = r.data;
  let populated = 0;
  if (rate.name) populated++;
  if (rate.short_name) populated++;
  if (rate.description) populated++;
  if (rate.currency) populated++;
  if (rate.base_price != null) populated++;
  if (rate.min_stay != null) populated++;
  if (rate.cancellation_policy) populated++;
  if (rate.meal_plan) populated++;
  if (rate.is_active != null) populated++;

  return {
    id: generateId('hotelrunner'),
    externalId: String(rate.rate_plan_id),
    pmsSource: 'hotelrunner',
    propertyExternalId: String(rate.property_id ?? ''),
    roomTypeExternalId: String(rate.room_type_id ?? ''),
    name: rate.name ?? '',
    code: rate.short_name ?? '',
    description: rate.description ?? '',
    currency: rate.currency ?? '',
    basePrice: Number(rate.base_price ?? 0),
    minStay: toInt(rate.min_stay),
    maxStay: toInt(rate.max_stay),
    isActive: rate.is_active !== false && rate.is_active !== 0,
    cancellationPolicy: rate.cancellation_policy ?? '',
    mealPlan: MEAL_MAP[(rate.meal_plan ?? '').toLowerCase()] ?? 'none',
    isRefundable: rate.is_refundable !== false && rate.is_refundable !== 0,
    advanceBookingMin: toInt(rate.min_advance),
    advanceBookingMax: toInt(rate.max_advance),
    confidence: calcConfidence(populated, TOTAL),
    rawData: rate as Record<string, unknown>,
  };
}

export function parseRates(rawApiResponse: unknown): CanonicalRate[] {
  const top = HRRateResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected rate response shape', top.error.flatten());
    return [];
  }
  return top.data.data.rate_plans.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
}
