import { z } from 'zod';
import { CanonicalProperty } from '../types/property.canonical';
import { calcConfidence, generateId, logger, pickLocalised, toInt } from '../utils';

const MewsAddressSchema = z.object({
  Line1: z.string().optional(),
  Line2: z.string().optional(),
  City: z.string().optional(),
  State: z.string().optional(),
  PostalCode: z.string().optional(),
  CountryCode: z.string().optional(),
  Latitude: z.number().optional(),
  Longitude: z.number().optional(),
}).passthrough();

const MewsHotelSchema = z.object({
  Id: z.string(),
  Name: z.record(z.string(), z.string()).optional(),
  Description: z.record(z.string(), z.string()).optional(),
  Address: MewsAddressSchema.optional(),
  Email: z.string().optional(),
  Telephone: z.string().optional(),
  WebsiteUrl: z.string().optional(),
  TimeZoneIdentifier: z.string().optional(),
  DefaultCurrencyCode: z.string().optional(),
  CheckInTime: z.string().optional(),
  CheckOutTime: z.string().optional(),
  SpaceCount: z.number().optional(),
  Amenities: z.array(z.string()).optional(),
  IsActive: z.boolean().optional(),
}).passthrough();

const MewsPropertyResponseSchema = z.object({
  hotels: z.array(z.unknown()),
}).passthrough();

const TOTAL = 11;

function parseHotel(raw: unknown): CanonicalProperty | null {
  const r = MewsHotelSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Mews: failed to parse hotel', r.error.flatten());
    return null;
  }
  const h = r.data;
  const addr = h.Address ?? {};
  let populated = 0;
  const name = pickLocalised(h.Name); if (name) populated++;
  const description = pickLocalised(h.Description); if (description) populated++;
  if (h.Address) populated++;
  if (h.Email) populated++;
  if (h.Telephone) populated++;
  if (h.WebsiteUrl) populated++;
  if (h.TimeZoneIdentifier) populated++;
  if (h.DefaultCurrencyCode) populated++;
  if (h.CheckInTime) populated++;
  if (h.CheckOutTime) populated++;
  if (h.IsActive != null) populated++;

  return {
    id: generateId('mews'),
    externalId: h.Id,
    pmsSource: 'mews',
    name,
    description,
    address: {
      line1: addr.Line1 ?? '',
      line2: addr.Line2 ?? '',
      city: addr.City ?? '',
      state: addr.State ?? '',
      country: addr.CountryCode ?? '',
      postalCode: addr.PostalCode ?? '',
      latitude: addr.Latitude ?? null,
      longitude: addr.Longitude ?? null,
    },
    phone: h.Telephone ?? '',
    email: h.Email ?? '',
    website: h.WebsiteUrl ?? '',
    timezone: h.TimeZoneIdentifier ?? '',
    currency: h.DefaultCurrencyCode ?? '',
    checkInTime: h.CheckInTime ?? '',
    checkOutTime: h.CheckOutTime ?? '',
    totalRooms: toInt(h.SpaceCount),
    amenities: h.Amenities ?? [],
    isActive: h.IsActive ?? true,
    confidence: calcConfidence(populated, TOTAL),
    rawData: h as Record<string, unknown>,
  };
}

export function parseProperties(rawApiResponse: unknown): CanonicalProperty[] {
  const top = MewsPropertyResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseHotel(i); return r ? [r] : []; });
    logger.error('Mews: unexpected property response shape', top.error.flatten());
    return [];
  }
  return top.data.hotels.flatMap(i => { const r = parseHotel(i); return r ? [r] : []; });
}
