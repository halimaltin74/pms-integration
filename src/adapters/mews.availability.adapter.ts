import { z } from 'zod';
import { CanonicalAvailability } from '../types/availability.canonical';
import { logger } from '../utils';

/**
 * Mews returns availability per category (room type) as a date-keyed object.
 * Shape: { categoryAvailabilities: [{ CategoryId, Availabilities: { "YYYY-MM-DD": count } }] }
 * We flatten to one record per date per room type.
 */
const MewsCategoryAvailabilitySchema = z.object({
  CategoryId: z.string(),
  Availabilities: z.record(z.string(), z.number()),
  ClosedDates: z.array(z.string()).optional(),
  ArrestDates: z.array(z.string()).optional(),
  MinimumNights: z.record(z.string(), z.number()).optional(),
}).passthrough();

const MewsAvailabilityResponseSchema = z.object({
  categoryAvailabilities: z.array(z.unknown()),
  propertyId: z.string().optional(),
}).passthrough();

function makeId(pms: string, propertyId: string, roomTypeId: string, date: string): string {
  return `${pms}_${propertyId}_${roomTypeId}_${date}`;
}

function parseCategory(raw: unknown, propertyExternalId: string): CanonicalAvailability[] {
  const r = MewsCategoryAvailabilitySchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Mews: failed to parse categoryAvailability', r.error.flatten());
    return [];
  }
  const cat = r.data;
  const closedSet = new Set(cat.ClosedDates ?? []);
  const arrestSet = new Set(cat.ArrestDates ?? []);

  return Object.entries(cat.Availabilities).map(([date, count]) => ({
    id: makeId('mews', propertyExternalId, cat.CategoryId, date),
    pmsSource: 'mews' as const,
    propertyExternalId,
    roomTypeExternalId: cat.CategoryId,
    date,
    availableRooms: count,
    totalRooms: 0,          // Mews doesn't return total in this endpoint
    isOpen: !closedSet.has(date),
    minStay: cat.MinimumNights?.[date] ?? 1,
    maxStay: 0,
    closedToArrival: arrestSet.has(date),
    closedToDeparture: false,
    prices: [],
    rawData: cat as Record<string, unknown>,
  }));
}

export function parseAvailability(rawApiResponse: unknown): CanonicalAvailability[] {
  const top = MewsAvailabilityResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    logger.error('Mews: unexpected availability response shape', top.error.flatten());
    return [];
  }
  const propertyId = top.data.propertyId ?? '';
  return top.data.categoryAvailabilities.flatMap(i => parseCategory(i, propertyId));
}
