import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const AvailabilityPriceSchema = z.object({
  rateExternalId: z.string(),
  price: z.number().nonnegative(),
  currency: z.string(),
});
export type AvailabilityPrice = z.infer<typeof AvailabilityPriceSchema>;

export const CanonicalAvailabilitySchema = z.object({
  id: z.string(),                     // generated: {pms}_{propertyId}_{roomTypeId}_{date}
  pmsSource: PMSSourceSchema,
  propertyExternalId: z.string(),
  roomTypeExternalId: z.string(),
  date: z.string(),                   // YYYY-MM-DD
  availableRooms: z.number().int().nonnegative(),
  totalRooms: z.number().int().nonnegative(),
  isOpen: z.boolean(),                // false = stop-sell / closed out
  minStay: z.number().int().nonnegative(),
  maxStay: z.number().int().nonnegative(),  // 0 = no restriction
  closedToArrival: z.boolean(),
  closedToDeparture: z.boolean(),
  prices: z.array(AvailabilityPriceSchema),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalAvailability = z.infer<typeof CanonicalAvailabilitySchema>;
