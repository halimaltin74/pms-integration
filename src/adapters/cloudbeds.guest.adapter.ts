import { z } from 'zod';
import { CanonicalGuest, Gender, IdType } from '../types/guest.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const CloudbedsGuestSchema = z.object({
  guestID: z.union([z.string(), z.number()]),
  guestFirstName: z.string().optional(),
  guestLastName: z.string().optional(),
  guestEmail: z.string().optional(),
  guestPhone: z.string().optional(),
  guestCountry: z.string().optional(),
  guestDateOfBirth: z.string().optional(),
  guestGender: z.string().optional(),
  guestDocumentType: z.string().optional(),
  guestDocumentNumber: z.string().optional(),
  guestAddress: z.string().optional(),
  guestCity: z.string().optional(),
  guestPostalCode: z.string().optional(),
  guestLanguage: z.string().optional(),
  guestNotes: z.string().optional(),
  isVip: z.union([z.boolean(), z.number()]).optional(),
}).passthrough();

const CloudbedsGuestResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
}).passthrough();

const GENDER_MAP: Record<string, Gender> = {
  male: 'male', m: 'male',
  female: 'female', f: 'female',
  other: 'other',
};

const ID_TYPE_MAP: Record<string, IdType> = {
  passport: 'passport',
  id_card: 'id_card',
  identity_card: 'id_card',
  driving_license: 'driving_license',
  drivers_license: 'driving_license',
};

const TOTAL = 8;

function parseGuest(raw: unknown): CanonicalGuest | null {
  const r = CloudbedsGuestSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Cloudbeds: failed to parse guest', r.error.flatten());
    return null;
  }
  const g = r.data;
  let populated = 0;
  const firstName = g.guestFirstName ?? ''; if (firstName) populated++;
  const lastName = g.guestLastName ?? ''; if (lastName) populated++;
  if (g.guestEmail) populated++;
  if (g.guestPhone) populated++;
  if (g.guestCountry) populated++;
  if (g.guestDateOfBirth) populated++;
  if (g.guestGender) populated++;
  if (g.guestDocumentType) populated++;

  return {
    id: generateId('cloudbeds'),
    externalId: String(g.guestID),
    pmsSource: 'cloudbeds',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: g.guestEmail ?? '',
    phone: g.guestPhone ?? '',
    nationality: g.guestCountry ?? '',
    dateOfBirth: g.guestDateOfBirth ?? '',
    gender: GENDER_MAP[(g.guestGender ?? '').toLowerCase()] ?? 'unknown',
    address: {
      line1: g.guestAddress ?? '',
      city: g.guestCity ?? '',
      country: g.guestCountry ?? '',
      postalCode: g.guestPostalCode ?? '',
    },
    idType: ID_TYPE_MAP[(g.guestDocumentType ?? '').toLowerCase()] ?? 'unknown',
    idNumber: g.guestDocumentNumber ?? '',
    language: g.guestLanguage ?? '',
    notes: g.guestNotes ?? '',
    isVip: g.isVip === true || g.isVip === 1,
    confidence: calcConfidence(populated, TOTAL),
    rawData: g as Record<string, unknown>,
  };
}

export function parseGuests(rawApiResponse: unknown): CanonicalGuest[] {
  const top = CloudbedsGuestResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected guest response shape', top.error.flatten());
    return [];
  }
  return top.data.data.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
}
