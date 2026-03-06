import { z } from 'zod';
import { CanonicalGuest, Gender, IdType } from '../types/guest.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const OperaProfileSchema = z.object({
  profileId: z.string(),
  profileType: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phones: z.array(z.object({ phoneNumber: z.string().optional(), phoneType: z.string().optional() })).optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
  vipStatus: z.union([z.boolean(), z.string()]).optional(),
  address: z.object({
    addressLine1: z.string().optional(),
    cityName: z.string().optional(),
    countryCode: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
}).passthrough();

const OperaGuestResponseSchema = z.object({
  profiles: z.object({
    profile: z.array(z.unknown()),
  }),
}).passthrough();

const GENDER_MAP: Record<string, Gender> = {
  MALE: 'male', M: 'male',
  FEMALE: 'female', F: 'female',
};

const ID_MAP: Record<string, IdType> = {
  PASSPORT: 'passport',
  IDENTITY_CARD: 'id_card',
  ID_CARD: 'id_card',
  DRIVING_LICENSE: 'driving_license',
};

const TOTAL = 9;

function parseGuest(raw: unknown): CanonicalGuest | null {
  const r = OperaProfileSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Opera: failed to parse profile', r.error.flatten());
    return null;
  }
  const g = r.data;
  let populated = 0;
  const firstName = g.firstName ?? ''; if (firstName) populated++;
  const lastName = g.lastName ?? ''; if (lastName) populated++;
  if (g.email) populated++;
  if (g.phones?.length) populated++;
  if (g.nationality) populated++;
  if (g.dateOfBirth) populated++;
  if (g.gender) populated++;
  if (g.documentType) populated++;
  if (g.language) populated++;

  const phone = g.phones?.find(p => p.phoneType === 'PHONE' || !p.phoneType)?.phoneNumber ?? '';
  const addr = g.address ?? {};
  const isVip = g.vipStatus === true || g.vipStatus === 'Y' || g.vipStatus === 'VIP';

  return {
    id: generateId('opera'),
    externalId: g.profileId,
    pmsSource: 'opera',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: g.email ?? '',
    phone,
    nationality: g.nationality ?? '',
    dateOfBirth: g.dateOfBirth ?? '',
    gender: GENDER_MAP[g.gender?.toUpperCase() ?? ''] ?? 'unknown',
    address: {
      line1: addr.addressLine1 ?? '',
      city: addr.cityName ?? '',
      country: addr.countryCode ?? '',
      postalCode: addr.postalCode ?? '',
    },
    idType: ID_MAP[g.documentType?.toUpperCase() ?? ''] ?? 'unknown',
    idNumber: g.documentNumber ?? '',
    language: g.language ?? '',
    notes: g.notes ?? '',
    isVip,
    confidence: calcConfidence(populated, TOTAL),
    rawData: g as Record<string, unknown>,
  };
}

export function parseGuests(rawApiResponse: unknown): CanonicalGuest[] {
  const top = OperaGuestResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
    logger.error('Opera: unexpected profile response shape', top.error.flatten());
    return [];
  }
  return top.data.profiles.profile.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
}
