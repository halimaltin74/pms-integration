import { z } from 'zod';
import { CanonicalProperty } from '../types/property.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const ElectroPropertySchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  description: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    lat: z.union([z.string(), z.number()]).optional(),
    lng: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  totalRooms: z.union([z.string(), z.number()]).optional(),
  active: z.union([z.boolean(), z.number()]).optional(),
  amenities: z.array(z.string()).optional(),
}).passthrough();

const ElectroPropertyResponseSchema = z.object({
  properties: z.array(z.unknown()),
}).passthrough();

const TOTAL = 11;

function parseProperty(raw: unknown): CanonicalProperty | null {
  const r = ElectroPropertySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Electro: failed to parse property', r.error.flatten());
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
  if (p.checkInTime) populated++;
  if (p.checkOutTime) populated++;
  if (p.active != null) populated++;

  const lat = addr.lat != null ? Number(addr.lat) : null;
  const lng = addr.lng != null ? Number(addr.lng) : null;

  return {
    id: generateId('electro'),
    externalId: String(p.id),
    pmsSource: 'electro',
    name: p.name ?? '',
    description: p.description ?? '',
    address: {
      line1: addr.line1 ?? '',
      line2: addr.line2 ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      country: addr.country ?? '',
      postalCode: addr.postalCode ?? '',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    },
    phone: p.phone ?? '',
    email: p.email ?? '',
    website: p.website ?? '',
    timezone: p.timezone ?? '',
    currency: p.currency ?? '',
    checkInTime: p.checkInTime ?? '',
    checkOutTime: p.checkOutTime ?? '',
    totalRooms: toInt(p.totalRooms),
    amenities: p.amenities ?? [],
    isActive: p.active !== false && p.active !== 0,
    confidence: calcConfidence(populated, TOTAL),
    rawData: p as Record<string, unknown>,
  };
}

export function parseProperties(rawApiResponse: unknown): CanonicalProperty[] {
  const top = ElectroPropertyResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseProperty(i); return r ? [r] : []; });
    logger.error('Electro: unexpected property response shape', top.error.flatten());
    return [];
  }
  return top.data.properties.flatMap(i => { const r = parseProperty(i); return r ? [r] : []; });
}
