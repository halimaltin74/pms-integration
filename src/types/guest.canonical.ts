import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const GenderSchema = z.enum(['male', 'female', 'other', 'unknown']);
export type Gender = z.infer<typeof GenderSchema>;

export const IdTypeSchema = z.enum(['passport', 'id_card', 'driving_license', 'other', 'unknown']);
export type IdType = z.infer<typeof IdTypeSchema>;

export const CanonicalGuestSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  nationality: z.string(),    // ISO 3166-1 alpha-2
  dateOfBirth: z.string(),    // YYYY-MM-DD or empty
  gender: GenderSchema,
  address: z.object({
    line1: z.string(),
    city: z.string(),
    country: z.string(),
    postalCode: z.string(),
  }),
  idType: IdTypeSchema,
  idNumber: z.string(),
  language: z.string(),       // ISO 639-1 e.g. "en"
  notes: z.string(),
  isVip: z.boolean(),
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalGuest = z.infer<typeof CanonicalGuestSchema>;
