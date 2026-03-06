import { z } from 'zod';
import { CanonicalProperty } from '../types/property.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const HRPropertySchema = z.object({
  property_id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  description: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional(),
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  total_rooms: z.union([z.string(), z.number()]).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
}).passthrough();

const HRPropertyResponseSchema = z.object({
  data: z.object({ property: z.unknown() }),
}).passthrough();

const TOTAL = 10;

function parseProperty(raw: unknown): CanonicalProperty | null {
  const r = HRPropertySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('HotelRunner: failed to parse property', r.error.flatten());
    return null;
  }
  const p = r.data;
  const addr = p.address ?? {};
  let populated = 0;
  if (p.name) populated++;
  if (p.description) populated++;
  if (p.address) populated++;
  if (p.phone) populated++;
  if (p.email) populated++;
  if (p.website) populated++;
  if (p.timezone) populated++;
  if (p.currency) populated++;
  if (p.check_in_time) populated++;
  if (p.check_out_time) populated++;

  const lat = addr.latitude != null ? Number(addr.latitude) : null;
  const lng = addr.longitude != null ? Number(addr.longitude) : null;

  return {
    id: generateId('hotelrunner'),
    externalId: String(p.property_id),
    pmsSource: 'hotelrunner',
    name: p.name ?? '',
    description: p.description ?? '',
    address: {
      line1: addr.street ?? '',
      line2: addr.street2 ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      country: addr.country ?? '',
      postalCode: addr.postal_code ?? '',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    },
    phone: p.phone ?? '',
    email: p.email ?? '',
    website: p.website ?? '',
    timezone: p.timezone ?? '',
    currency: p.currency ?? '',
    checkInTime: p.check_in_time ?? '',
    checkOutTime: p.check_out_time ?? '',
    totalRooms: toInt(p.total_rooms),
    amenities: [],
    isActive: p.is_active !== false && p.is_active !== 0,
    confidence: calcConfidence(populated, TOTAL),
    rawData: p as Record<string, unknown>,
  };
}

export function parseProperties(rawApiResponse: unknown): CanonicalProperty[] {
  const top = HRPropertyResponseSchema.safeParse(rawApiResponse);
  if (top.success) {
    const r = parseProperty(top.data.data.property);
    return r ? [r] : [];
  }
  const r = parseProperty(rawApiResponse);
  return r ? [r] : [];
}
