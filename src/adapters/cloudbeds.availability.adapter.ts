import { z } from 'zod';
import { CanonicalAvailability } from '../types/availability.canonical';
import { logger, toInt } from '../utils';

const CloudbedsAvailabilityEntrySchema = z.object({
  roomTypeID: z.union([z.string(), z.number()]),
  propertyID: z.union([z.string(), z.number()]).optional(),
  date: z.string(),
  available: z.union([z.string(), z.number()]).optional(),
  totalRooms: z.union([z.string(), z.number()]).optional(),
  isOpen: z.union([z.boolean(), z.number(), z.string()]).optional(),
  minStay: z.union([z.string(), z.number()]).optional(),
  maxStay: z.union([z.string(), z.number()]).optional(),
  closedToArrival: z.union([z.boolean(), z.number()]).optional(),
  closedToDeparture: z.union([z.boolean(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  ratePlanID: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const CloudbedsAvailabilityResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
}).passthrough();

function coerceBool(v: unknown, fallback = true): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

function makeId(propertyId: string, roomTypeId: string, date: string): string {
  return `cloudbeds_${propertyId}_${roomTypeId}_${date}`;
}

function parseEntry(raw: unknown): CanonicalAvailability | null {
  const r = CloudbedsAvailabilityEntrySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Cloudbeds: failed to parse availability entry', r.error.flatten());
    return null;
  }
  const e = r.data;
  const roomTypeId = String(e.roomTypeID);
  const propertyId = String(e.propertyID ?? '');
  const price = e.price != null ? Number(e.price) : undefined;

  return {
    id: makeId(propertyId, roomTypeId, e.date),
    pmsSource: 'cloudbeds',
    propertyExternalId: propertyId,
    roomTypeExternalId: roomTypeId,
    date: e.date,
    availableRooms: toInt(e.available),
    totalRooms: toInt(e.totalRooms),
    isOpen: coerceBool(e.isOpen),
    minStay: toInt(e.minStay, 1),
    maxStay: toInt(e.maxStay),
    closedToArrival: typeof e.closedToArrival === 'boolean' ? e.closedToArrival : e.closedToArrival === 1,
    closedToDeparture: typeof e.closedToDeparture === 'boolean' ? e.closedToDeparture : e.closedToDeparture === 1,
    prices: price != null && e.currency
      ? [{ rateExternalId: String(e.ratePlanID ?? ''), price, currency: e.currency }]
      : [],
    rawData: e as Record<string, unknown>,
  };
}

export function parseAvailability(rawApiResponse: unknown): CanonicalAvailability[] {
  const top = CloudbedsAvailabilityResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected availability response shape', top.error.flatten());
    return [];
  }
  return top.data.data.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
}
