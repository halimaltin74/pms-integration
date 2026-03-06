import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const MealPlanSchema = z.enum([
  'none',
  'breakfast',
  'half_board',
  'full_board',
  'all_inclusive',
]);
export type MealPlan = z.infer<typeof MealPlanSchema>;

export const CanonicalRateSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  propertyExternalId: z.string(),
  roomTypeExternalId: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  currency: z.string(),
  basePrice: z.number().nonnegative(),
  minStay: z.number().int().nonnegative(),    // minimum nights; 0 = no restriction
  maxStay: z.number().int().nonnegative(),    // 0 = no restriction
  isActive: z.boolean(),
  cancellationPolicy: z.string(),
  mealPlan: MealPlanSchema,
  isRefundable: z.boolean(),
  advanceBookingMin: z.number().int().nonnegative(),  // min days before arrival
  advanceBookingMax: z.number().int().nonnegative(),  // 0 = no limit
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalRate = z.infer<typeof CanonicalRateSchema>;
