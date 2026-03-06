import { z } from 'zod';
import { CanonicalGuest, Gender, IdType } from '../types/guest.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const MewsCustomerSchema = z.object({
  Id: z.string(),
  FirstName: z.string().optional(),
  LastName: z.string().optional(),
  Email: z.string().optional(),
  Phone: z.string().optional(),
  NationalityCode: z.string().optional(),
  BirthDateUtc: z.string().optional(),
  Sex: z.string().optional(),
  LanguageCode: z.string().optional(),
  Notes: z.string().optional(),
  IsVip: z.boolean().optional(),
  Address: z.object({
    Line1: z.string().optional(),
    City: z.string().optional(),
    CountryCode: z.string().optional(),
    PostalCode: z.string().optional(),
  }).optional(),
  IdentityDocuments: z.array(z.object({
    Type: z.string().optional(),
    Number: z.string().optional(),
  })).optional(),
}).passthrough();

const MewsGuestResponseSchema = z.object({
  customers: z.array(z.unknown()),
}).passthrough();

const GENDER_MAP: Record<string, Gender> = {
  Male: 'male',
  Female: 'female',
  Unknown: 'unknown',
};

const ID_TYPE_MAP: Record<string, IdType> = {
  Passport: 'passport',
  IdentityCard: 'id_card',
  DriversLicense: 'driving_license',
};

const TOTAL = 9;

function parseGuest(raw: unknown): CanonicalGuest | null {
  const r = MewsCustomerSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Mews: failed to parse customer', r.error.flatten());
    return null;
  }
  const g = r.data;
  let populated = 0;
  const firstName = g.FirstName ?? ''; if (firstName) populated++;
  const lastName = g.LastName ?? ''; if (lastName) populated++;
  if (g.Email) populated++;
  if (g.Phone) populated++;
  if (g.NationalityCode) populated++;
  if (g.BirthDateUtc) populated++;
  if (g.Sex) populated++;
  if (g.LanguageCode) populated++;
  if (g.IdentityDocuments?.length) populated++;

  const doc = g.IdentityDocuments?.[0];
  const addr = g.Address ?? {};

  return {
    id: generateId('mews'),
    externalId: g.Id,
    pmsSource: 'mews',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: g.Email ?? '',
    phone: g.Phone ?? '',
    nationality: g.NationalityCode ?? '',
    dateOfBirth: g.BirthDateUtc ? g.BirthDateUtc.split('T')[0] : '',
    gender: GENDER_MAP[g.Sex ?? ''] ?? 'unknown',
    address: {
      line1: addr.Line1 ?? '',
      city: addr.City ?? '',
      country: addr.CountryCode ?? '',
      postalCode: addr.PostalCode ?? '',
    },
    idType: ID_TYPE_MAP[doc?.Type ?? ''] ?? 'unknown',
    idNumber: doc?.Number ?? '',
    language: g.LanguageCode ?? '',
    notes: g.Notes ?? '',
    isVip: g.IsVip ?? false,
    confidence: calcConfidence(populated, TOTAL),
    rawData: g as Record<string, unknown>,
  };
}

export function parseGuests(rawApiResponse: unknown): CanonicalGuest[] {
  const top = MewsGuestResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
    logger.error('Mews: unexpected customer response shape', top.error.flatten());
    return [];
  }
  return top.data.customers.flatMap(i => { const r = parseGuest(i); return r ? [r] : []; });
}
