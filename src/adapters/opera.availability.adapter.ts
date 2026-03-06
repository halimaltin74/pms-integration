import { z } from 'zod';
import { CanonicalAvailability } from '../types/availability.canonical';
import { logger, toInt } from '../utils';

const OperaAvailabilityEntrySchema = z.object({
  roomType: z.string(),
  hotelId: z.string().optional(),
  date: z.string(),
  available: z.union([z.string(), z.number()]).optional(),
  totalInventory: z.union([z.string(), z.number()]).optional(),
  housekeepingStatus: z.string().optional(),  // "OPEN" | "CLOSED"
  minimumStayThrough: z.union([z.string(), z.number()]).optional(),
  maximumStay: z.union([z.string(), z.number()]).optional(),
  closedToArrival: z.union([z.boolean(), z.string()]).optional(),
  closedToDeparture: z.union([z.boolean(), z.string()]).optional(),
  rateAmount: z.union([z.string(), z.number()]).optional(),
  currencyCode: z.string().optional(),
  ratePlanCode: z.string().optional(),
}).passthrough();

const OperaAvailabilityResponseSchema = z.object({
  availability: z.array(z.unknown()),
}).passthrough();

function coerceBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toUpperCase() === 'Y' || v === 'true';
  return fallback;
}

function makeId(hotelId: string, roomType: string, date: string): string {
  return `opera_${hotelId}_${roomType}_${date}`;
}

function parseEntry(raw: unknown): CanonicalAvailability | null {
  const r = OperaAvailabilityEntrySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Opera: failed to parse availability entry', r.error.flatten());
    return null;
  }
  const e = r.data;
  const hotelId = e.hotelId ?? '';
  const price = e.rateAmount != null ? Number(e.rateAmount) : undefined;

  return {
    id: makeId(hotelId, e.roomType, e.date),
    pmsSource: 'opera',
    propertyExternalId: hotelId,
    roomTypeExternalId: e.roomType,
    date: e.date,
    availableRooms: toInt(e.available),
    totalRooms: toInt(e.totalInventory),
    isOpen: e.housekeepingStatus ? e.housekeepingStatus.toUpperCase() === 'OPEN' : true,
    minStay: toInt(e.minimumStayThrough, 1),
    maxStay: toInt(e.maximumStay),
    closedToArrival: coerceBool(e.closedToArrival),
    closedToDeparture: coerceBool(e.closedToDeparture),
    prices: price != null && e.currencyCode
      ? [{ rateExternalId: e.ratePlanCode ?? '', price, currency: e.currencyCode }]
      : [],
    rawData: e as Record<string, unknown>,
  };
}

export function parseAvailability(rawApiResponse: unknown): CanonicalAvailability[] {
  const top = OperaAvailabilityResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
    logger.error('Opera: unexpected availability response shape', top.error.flatten());
    return [];
  }
  return top.data.availability.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
}
