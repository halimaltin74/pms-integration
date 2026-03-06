import { z } from 'zod';
import { CanonicalRate, MealPlan } from '../types/rate.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const OperaRatePlanSchema = z.object({
  ratePlanCode: z.string(),
  hotelId: z.string().optional(),
  roomType: z.string().optional(),
  ratePlanName: z.string().optional(),
  ratePlanDescription: z.string().optional(),
  currency: z.string().optional(),
  rateAmount: z.union([z.string(), z.number()]).optional(),
  minimumStay: z.union([z.string(), z.number()]).optional(),
  maximumStay: z.union([z.string(), z.number()]).optional(),
  activeFlag: z.string().optional(),
  mealPlan: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  isRefundable: z.union([z.boolean(), z.string()]).optional(),
  minimumAdvance: z.union([z.string(), z.number()]).optional(),
  maximumAdvance: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const OperaRateResponseSchema = z.object({
  ratePlans: z.object({
    ratePlan: z.array(z.unknown()),
  }),
}).passthrough();

const MEAL_MAP: Record<string, MealPlan> = {
  NONE: 'none',
  BREAKFAST: 'breakfast',
  HALFBOARD: 'half_board',
  'HALF BOARD': 'half_board',
  FULLBOARD: 'full_board',
  'FULL BOARD': 'full_board',
  ALLINCLUSIVE: 'all_inclusive',
  'ALL INCLUSIVE': 'all_inclusive',
};

const TOTAL = 9;

function parseRate(raw: unknown): CanonicalRate | null {
  const r = OperaRatePlanSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Opera: failed to parse ratePlan', r.error.flatten());
    return null;
  }
  const rate = r.data;
  let populated = 0;
  if (rate.ratePlanName) populated++;
  if (rate.ratePlanDescription) populated++;
  if (rate.currency) populated++;
  if (rate.rateAmount != null) populated++;
  if (rate.minimumStay != null) populated++;
  if (rate.activeFlag) populated++;
  if (rate.mealPlan) populated++;
  if (rate.cancellationPolicy) populated++;
  if (rate.isRefundable != null) populated++;

  const isRefundable = rate.isRefundable === true || rate.isRefundable === 'Y' || rate.isRefundable === 'true';

  return {
    id: generateId('opera'),
    externalId: rate.ratePlanCode,
    pmsSource: 'opera',
    propertyExternalId: rate.hotelId ?? '',
    roomTypeExternalId: rate.roomType ?? '',
    name: rate.ratePlanName ?? '',
    code: rate.ratePlanCode,
    description: rate.ratePlanDescription ?? '',
    currency: rate.currency ?? '',
    basePrice: Number(rate.rateAmount ?? 0),
    minStay: toInt(rate.minimumStay),
    maxStay: toInt(rate.maximumStay),
    isActive: rate.activeFlag ? rate.activeFlag.toUpperCase() === 'Y' : true,
    cancellationPolicy: rate.cancellationPolicy ?? '',
    mealPlan: MEAL_MAP[(rate.mealPlan ?? '').toUpperCase()] ?? 'none',
    isRefundable,
    advanceBookingMin: toInt(rate.minimumAdvance),
    advanceBookingMax: toInt(rate.maximumAdvance),
    confidence: calcConfidence(populated, TOTAL),
    rawData: rate as Record<string, unknown>,
  };
}

export function parseRates(rawApiResponse: unknown): CanonicalRate[] {
  const top = OperaRateResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
    logger.error('Opera: unexpected rate response shape', top.error.flatten());
    return [];
  }
  return top.data.ratePlans.ratePlan.flatMap(i => { const r = parseRate(i); return r ? [r] : []; });
}
