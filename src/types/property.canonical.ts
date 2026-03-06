import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const CanonicalAddressSchema = z.object({
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),      // ISO 3166-1 alpha-2
  postalCode: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
export type CanonicalAddress = z.infer<typeof CanonicalAddressSchema>;

export const CanonicalPropertySchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  name: z.string(),
  description: z.string(),
  address: CanonicalAddressSchema,
  phone: z.string(),
  email: z.string(),
  website: z.string(),
  timezone: z.string(),       // IANA e.g. "Europe/Istanbul"
  currency: z.string(),       // ISO 4217 e.g. "EUR"
  checkInTime: z.string(),    // HH:mm
  checkOutTime: z.string(),   // HH:mm
  totalRooms: z.number().int().nonnegative(),
  amenities: z.array(z.string()),
  isActive: z.boolean(),
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalProperty = z.infer<typeof CanonicalPropertySchema>;
