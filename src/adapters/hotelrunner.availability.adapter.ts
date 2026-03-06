import { z } from 'zod';
import { CanonicalAvailability } from '../types/availability.canonical';
import { logger, toInt } from '../utils';

const HRAvailabilityEntrySchema = z.object({
  room_type_id: z.union([z.string(), z.number()]),
  property_id: z.union([z.string(), z.number()]).optional(),
  date: z.string(),
  available_rooms: z.union([z.string(), z.number()]).optional(),
  total_rooms: z.union([z.string(), z.number()]).optional(),
  is_open: z.union([z.boolean(), z.number()]).optional(),
  min_stay: z.union([z.string(), z.number()]).optional(),
  max_stay: z.union([z.string(), z.number()]).optional(),
  closed_to_arrival: z.union([z.boolean(), z.number()]).optional(),
  closed_to_departure: z.union([z.boolean(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  rate_plan_id: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const HRAvailabilityResponseSchema = z.object({
  data: z.object({ availability: z.array(z.unknown()) }),
}).passthrough();

function coerceBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function makeId(propertyId: string, roomTypeId: string, date: string): string {
  return `hotelrunner_${propertyId}_${roomTypeId}_${date}`;
}

function parseEntry(raw: unknown): CanonicalAvailability | null {
  const r = HRAvailabilityEntrySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('HotelRunner: failed to parse availability entry', r.error.flatten());
    return null;
  }
  const e = r.data;
  const roomTypeId = String(e.room_type_id);
  const propertyId = String(e.property_id ?? '');
  const price = e.price != null ? Number(e.price) : undefined;

  return {
    id: makeId(propertyId, roomTypeId, e.date),
    pmsSource: 'hotelrunner',
    propertyExternalId: propertyId,
    roomTypeExternalId: roomTypeId,
    date: e.date,
    availableRooms: toInt(e.available_rooms),
    totalRooms: toInt(e.total_rooms),
    isOpen: coerceBool(e.is_open, true),
    minStay: toInt(e.min_stay, 1),
    maxStay: toInt(e.max_stay),
    closedToArrival: coerceBool(e.closed_to_arrival),
    closedToDeparture: coerceBool(e.closed_to_departure),
    prices: price != null && e.currency
      ? [{ rateExternalId: String(e.rate_plan_id ?? ''), price, currency: e.currency }]
      : [],
    rawData: e as Record<string, unknown>,
  };
}

export function parseAvailability(rawApiResponse: unknown): CanonicalAvailability[] {
  const top = HRAvailabilityResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected availability response shape', top.error.flatten());
    return [];
  }
  return top.data.data.availability.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
}
