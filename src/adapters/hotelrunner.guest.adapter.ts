import { z } from 'zod';
import { CanonicalGuest, Gender, IdType } from '../types/guest.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const HRGuestSchema = z.object({
  guest_id: z.union([z.string(), z.number()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
  is_vip: z.union([z.boolean(), z.number()]).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional(),
  }).optional(),
}).passthrough();

const HRGuestResponseSchema = z.object({
  data: z.object({ guests: z.array(z.unknown()) }),
}).passthrough();

const GENDER_MAP: Record<string, Gender> = {
  male: 'male', m: 'male',
  female: 'female', f: 'female',
  other: 'other',
};

const ID_MAP: Record<string, IdType> = {
  passport: 'passport',
  id_card: 'id_card',
  driving_license: 'driving_license',
};

const TOTAL = 8;

function parseGuest(raw: unknown): CanonicalGuest | null {
  const r = HRGuestSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('HotelRunner: failed to parse guest', r.error.flatten());
    return null;
  }
  const g = r.data;
  let populated = 0;
  const firstName = g.first_name ?? ''; if (firstName) populated++;
  const lastName = g.last_name ?? ''; if (lastName) populated++;
  if (g.email) populated++;
  if (g.phone) populated++;
  if (g.nationality) populated++;
  if (g.date_of_birth) populated++;
  if (g.gender) populated++;
  if (g.id_type) populated++;

  const addr = g.address ?? {};

  return {
    id: generateId('hotelrunner'),
    externalId: String(g.guest_id),
    pmsSource: 'hotelrunner',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: g.email ?? '',
    phone: g.phone ?? '',
    nationality: g.nationality ?? '',
    dateOfBirth: g.date_of_birth ?? '',
    gender: GENDER_MAP[(g.gender ?? '').toLowerCase()] ?? 'unknown',
    address: {
      line1: addr.street ?? '',
      city: addr.city ?? '',
      country: addr.country ?? '',
      postalCode: addr.postal_code ?? '',
    },
    idType: ID_MAP[(g.id_type ?? '').toLowerCase()] ?? 'unknown',
    idNumber: g.id_number ?? '',
    language: g.language ?? '',
    notes: g.notes ?? '',
    isVip: g.is_vip === true || g.is_vip === 1,
    confidence: calcConfidence(populated, TOTAL),
    rawData: g as Record<string, unknown>,
  };
}

export function parseGuests(rawApiResponse: unknown): CanonicalGuest[] {
  const top = HRGuestResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected guest response shape', top.error.flatten());
    return [];
  }
  return top.data.data.guests.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
}
