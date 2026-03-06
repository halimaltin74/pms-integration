import { z } from 'zod';
import { CanonicalProperty } from '../types/property.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const OperaContactSchema = z.object({
  phoneNumber: z.string().optional(),
  phoneType: z.string().optional(),
}).passthrough();

const OperaHotelInfoSchema = z.object({
  hotelCode: z.string(),
  hotelName: z.string().optional(),
  hotelDescription: z.string().optional(),
  hotelType: z.string().optional(),
  address: z.object({
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    cityName: z.string().optional(),
    stateProv: z.string().optional(),
    countryCode: z.string().optional(),
    postalCode: z.string().optional(),
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  contactNumbers: z.array(OperaContactSchema).optional(),
  hotelEmail: z.string().optional(),
  hotelWebsite: z.string().optional(),
  timeZone: z.string().optional(),
  currency: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  totalRooms: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const OperaPropertyResponseSchema = z.object({
  hotelInfo: z.unknown(),
}).passthrough();

const TOTAL = 10;

function parseHotelInfo(raw: unknown): CanonicalProperty | null {
  const r = OperaHotelInfoSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Opera: failed to parse hotelInfo', r.error.flatten());
    return null;
  }
  const h = r.data;
  const addr = h.address ?? {};
  const phone = h.contactNumbers?.find(c => c.phoneType === 'PHONE' || !c.phoneType)?.phoneNumber ?? '';

  let populated = 0;
  if (h.hotelName) populated++;
  if (h.hotelDescription) populated++;
  if (h.address) populated++;
  if (phone) populated++;
  if (h.hotelEmail) populated++;
  if (h.hotelWebsite) populated++;
  if (h.timeZone) populated++;
  if (h.currency) populated++;
  if (h.checkInTime) populated++;
  if (h.checkOutTime) populated++;

  const lat = addr.latitude != null ? Number(addr.latitude) : null;
  const lng = addr.longitude != null ? Number(addr.longitude) : null;

  return {
    id: generateId('opera'),
    externalId: h.hotelCode,
    pmsSource: 'opera',
    name: h.hotelName ?? '',
    description: h.hotelDescription ?? '',
    address: {
      line1: addr.addressLine1 ?? '',
      line2: addr.addressLine2 ?? '',
      city: addr.cityName ?? '',
      state: addr.stateProv ?? '',
      country: addr.countryCode ?? '',
      postalCode: addr.postalCode ?? '',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    },
    phone,
    email: h.hotelEmail ?? '',
    website: h.hotelWebsite ?? '',
    timezone: h.timeZone ?? '',
    currency: h.currency ?? '',
    checkInTime: h.checkInTime ?? '',
    checkOutTime: h.checkOutTime ?? '',
    totalRooms: toInt(h.totalRooms),
    amenities: [],
    isActive: true,
    confidence: calcConfidence(populated, TOTAL),
    rawData: h as Record<string, unknown>,
  };
}

export function parseProperties(rawApiResponse: unknown): CanonicalProperty[] {
  const top = OperaPropertyResponseSchema.safeParse(rawApiResponse);
  if (top.success) {
    const r = parseHotelInfo(top.data.hotelInfo);
    return r ? [r] : [];
  }
  const r = parseHotelInfo(rawApiResponse);
  return r ? [r] : [];
}
