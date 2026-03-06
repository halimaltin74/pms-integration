import { z } from 'zod';
import { CanonicalGuest, Gender, IdType } from '../types/guest.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const ElectroGuestSchema = z.object({
  id: z.union([z.string(), z.number()]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.union([z.boolean(), z.number()]).optional(),
  address: z.object({
    line1: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
}).passthrough();

const ElectroGuestResponseSchema = z.object({
  guests: z.array(z.unknown()),
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
  const r = ElectroGuestSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Electro: failed to parse guest', r.error.flatten());
    return null;
  }
  const g = r.data;
  let populated = 0;
  const firstName = g.firstName ?? ''; if (firstName) populated++;
  const lastName = g.lastName ?? ''; if (lastName) populated++;
  if (g.email) populated++;
  if (g.phone) populated++;
  if (g.nationality) populated++;
  if (g.dateOfBirth) populated++;
  if (g.gender) populated++;
  if (g.idType) populated++;

  const addr = g.address ?? {};

  return {
    id: generateId('electro'),
    externalId: String(g.id),
    pmsSource: 'electro',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: g.email ?? '',
    phone: g.phone ?? '',
    nationality: g.nationality ?? '',
    dateOfBirth: g.dateOfBirth ?? '',
    gender: GENDER_MAP[(g.gender ?? '').toLowerCase()] ?? 'unknown',
    address: {
      line1: addr.line1 ?? '',
      city: addr.city ?? '',
      country: addr.country ?? '',
      postalCode: addr.postalCode ?? '',
    },
    idType: ID_MAP[(g.idType ?? '').toLowerCase()] ?? 'unknown',
    idNumber: g.idNumber ?? '',
    language: g.language ?? '',
    notes: g.notes ?? '',
    isVip: g.isVip === true || g.isVip === 1,
    confidence: calcConfidence(populated, TOTAL),
    rawData: g as Record<string, unknown>,
  };
}

export function parseGuests(rawApiResponse: unknown): CanonicalGuest[] {
  const top = ElectroGuestResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
    logger.error('Electro: unexpected guest response shape', top.error.flatten());
    return [];
  }
  return top.data.guests.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
}
