import { z } from 'zod';
import { CanonicalAvailability } from '../types/availability.canonical';
import { logger, toInt } from '../utils';

const ElectroAvailabilityEntrySchema = z.object({
  roomTypeId: z.union([z.string(), z.number()]),
  propertyId: z.union([z.string(), z.number()]).optional(),
  date: z.string(),
  availableRooms: z.union([z.string(), z.number()]).optional(),
  totalRooms: z.union([z.string(), z.number()]).optional(),
  isOpen: z.union([z.boolean(), z.number()]).optional(),
  minStay: z.union([z.string(), z.number()]).optional(),
  maxStay: z.union([z.string(), z.number()]).optional(),
  closedToArrival: z.union([z.boolean(), z.number()]).optional(),
  closedToDeparture: z.union([z.boolean(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  rateId: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const ElectroAvailabilityResponseSchema = z.object({
  availability: z.array(z.unknown()),
}).passthrough();

function coerceBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function makeId(propertyId: string, roomTypeId: string, date: string): string {
  return `electro_${propertyId}_${roomTypeId}_${date}`;
}

function parseEntry(raw: unknown): CanonicalAvailability | null {
  const r = ElectroAvailabilityEntrySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Electro: failed to parse availability entry', r.error.flatten());
    return null;
  }
  const e = r.data;
  const roomTypeId = String(e.roomTypeId);
  const propertyId = String(e.propertyId ?? '');
  const price = e.price != null ? Number(e.price) : undefined;

  return {
    id: makeId(propertyId, roomTypeId, e.date),
    pmsSource: 'electro',
    propertyExternalId: propertyId,
    roomTypeExternalId: roomTypeId,
    date: e.date,
    availableRooms: toInt(e.availableRooms),
    totalRooms: toInt(e.totalRooms),
    isOpen: coerceBool(e.isOpen, true),
    minStay: toInt(e.minStay, 1),
    maxStay: toInt(e.maxStay),
    closedToArrival: coerceBool(e.closedToArrival),
    closedToDeparture: coerceBool(e.closedToDeparture),
    prices: price != null && e.currency
      ? [{ rateExternalId: String(e.rateId ?? ''), price, currency: e.currency }]
      : [],
    rawData: e as Record<string, unknown>,
  };
}

export function parseAvailability(rawApiResponse: unknown): CanonicalAvailability[] {
  const top = ElectroAvailabilityResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
    logger.error('Electro: unexpected availability response shape', top.error.flatten());
    return [];
  }
  return top.data.availability.flatMap(i => { const r = parseEntry(i); return r ? [r] : []; });
}
