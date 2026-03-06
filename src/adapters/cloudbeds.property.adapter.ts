import { z } from 'zod';
import { CanonicalProperty } from '../types/property.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const CloudbedsPropertySchema = z.object({
  propertyID: z.union([z.string(), z.number()]),
  propertyName: z.string().optional(),
  propertyDescription: z.string().optional(),
  propertyAddress: z.string().optional(),
  propertyAddress2: z.string().optional(),
  propertyCity: z.string().optional(),
  propertyState: z.string().optional(),
  propertyCountry: z.string().optional(),
  propertyCountryCode: z.string().optional(),
  propertyPostalCode: z.string().optional(),
  propertyPhone: z.string().optional(),
  propertyEmail: z.string().optional(),
  propertyWebsite: z.string().optional(),
  propertyTimezone: z.string().optional(),
  propertyCurrency: z.string().optional(),
  propertyCheckInTime: z.string().optional(),
  propertyCheckOutTime: z.string().optional(),
  propertyLat: z.union([z.string(), z.number()]).optional(),
  propertyLng: z.union([z.string(), z.number()]).optional(),
  propertyTotalRooms: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const CloudbedsPropertyResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
}).passthrough();

const TOTAL = 11;

function parseProperty(raw: unknown): CanonicalProperty | null {
  const r = CloudbedsPropertySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Cloudbeds: failed to parse property', r.error.flatten());
    return null;
  }
  const p = r.data;
  let populated = 0;
  if (p.propertyName) populated++;
  if (p.propertyDescription) populated++;
  if (p.propertyAddress) populated++;
  if (p.propertyPhone) populated++;
  if (p.propertyEmail) populated++;
  if (p.propertyWebsite) populated++;
  if (p.propertyTimezone) populated++;
  if (p.propertyCurrency) populated++;
  if (p.propertyCheckInTime) populated++;
  if (p.propertyCheckOutTime) populated++;
  if (p.propertyLat != null) populated++;

  const lat = p.propertyLat != null ? Number(p.propertyLat) : null;
  const lng = p.propertyLng != null ? Number(p.propertyLng) : null;

  return {
    id: generateId('cloudbeds'),
    externalId: String(p.propertyID),
    pmsSource: 'cloudbeds',
    name: p.propertyName ?? '',
    description: p.propertyDescription ?? '',
    address: {
      line1: p.propertyAddress ?? '',
      line2: p.propertyAddress2 ?? '',
      city: p.propertyCity ?? '',
      state: p.propertyState ?? '',
      country: p.propertyCountryCode ?? p.propertyCountry ?? '',
      postalCode: p.propertyPostalCode ?? '',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    },
    phone: p.propertyPhone ?? '',
    email: p.propertyEmail ?? '',
    website: p.propertyWebsite ?? '',
    timezone: p.propertyTimezone ?? '',
    currency: p.propertyCurrency ?? '',
    checkInTime: p.propertyCheckInTime ?? '',
    checkOutTime: p.propertyCheckOutTime ?? '',
    totalRooms: toInt(p.propertyTotalRooms),
    amenities: [],
    isActive: true,
    confidence: calcConfidence(populated, TOTAL),
    rawData: p as Record<string, unknown>,
  };
}

export function parseProperties(rawApiResponse: unknown): CanonicalProperty[] {
  const top = CloudbedsPropertyResponseSchema.safeParse(rawApiResponse);
  if (top.success) {
    const r = parseProperty(top.data.data);
    return r ? [r] : [];
  }
  const r = parseProperty(rawApiResponse);
  return r ? [r] : [];
}
