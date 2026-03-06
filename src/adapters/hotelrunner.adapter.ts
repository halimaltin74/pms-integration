/**
 * HotelRunner REST API adapter.
 *
 * Room types come from the property configuration endpoint.
 * Uses snake_case field names typical of Ruby/Rails APIs.
 */

import { z } from 'zod';
import { CanonicalRoomType } from '../types/canonical';
import { calcConfidence, generateId, logger, normaliseBedType, toInt } from '../utils';

// ---------------------------------------------------------------------------
// Raw HotelRunner schema (Zod)
// ---------------------------------------------------------------------------

const HotelRunnerRoomTypeSchema = z.object({
  room_type_id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  short_name: z.string().optional(),
  capacity: z.union([z.string(), z.number()]).optional(),
  room_count: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  is_active: z.union([z.boolean(), z.number(), z.string()]).optional(),
  bed_type: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  default_capacity: z.union([z.string(), z.number()]).optional(),
}).passthrough();

/**
 * HotelRunner typically wraps results in { data: { room_types: [...] } }
 * but also accepts a flat array.
 */
const HotelRunnerResponseSchema = z.object({
  data: z.object({
    room_types: z.array(z.unknown()),
  }),
}).passthrough();

type HotelRunnerRoomType = z.infer<typeof HotelRunnerRoomTypeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'active') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'inactive') return false;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const TOTAL_SCORED_FIELDS = 9;

function parseRoomType(raw: unknown): CanonicalRoomType | null {
  const result = HotelRunnerRoomTypeSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('HotelRunner: failed to parse room_type entry', result.error.flatten());
    return null;
  }
  const r: HotelRunnerRoomType = result.data;

  const name = r.name ?? '';
  const shortCode = r.short_name ?? name.slice(0, 4).toUpperCase();
  const description = r.description ?? '';
  const maxOccupancy = r.capacity != null ? toInt(r.capacity) : 0;
  const defaultOccupancy = r.default_capacity != null ? toInt(r.default_capacity) : maxOccupancy;
  const roomCount = r.room_count != null ? toInt(r.room_count) : 0;
  const isActive = coerceBool(r.is_active);
  const amenities = r.amenities ?? [];
  const bedType = normaliseBedType(r.bed_type);

  if (!r.name) logger.warn('HotelRunner: room_type missing name', { id: r.room_type_id });
  if (r.capacity == null) logger.warn('HotelRunner: room_type missing capacity', { id: r.room_type_id });
  if (r.room_count == null) logger.warn('HotelRunner: room_type missing room_count', { id: r.room_type_id });

  let populated = 0;
  if (name) populated++;
  if (r.short_name) populated++;
  if (description) populated++;
  if (r.capacity != null) populated++;
  if (r.default_capacity != null) populated++;
  if (r.bed_type) populated++;
  if (r.room_count != null) populated++;
  if (amenities.length > 0) populated++;
  if (r.is_active != null) populated++;

  return {
    id: generateId('hotelrunner'),
    externalId: String(r.room_type_id),
    pmsSource: 'hotelrunner',
    name,
    shortCode,
    description,
    maxOccupancy,
    defaultOccupancy,
    bedType,
    roomCount,
    amenities,
    isActive,
    confidence: calcConfidence(populated, TOTAL_SCORED_FIELDS),
    rawData: r as Record<string, unknown>,
  };
}

/**
 * Parses a raw HotelRunner room types response and returns normalised room types.
 * Never throws — returns [] on unrecoverable errors.
 */
export function parseRoomTypes(rawApiResponse: unknown): CanonicalRoomType[] {
  const topLevel = HotelRunnerResponseSchema.safeParse(rawApiResponse);
  if (!topLevel.success) {
    if (Array.isArray(rawApiResponse)) {
      return rawApiResponse.flatMap((item) => {
        const r = parseRoomType(item);
        return r ? [r] : [];
      });
    }
    logger.error('HotelRunner: unexpected response shape', topLevel.error.flatten());
    return [];
  }

  return topLevel.data.data.room_types.flatMap((item) => {
    const r = parseRoomType(item);
    return r ? [r] : [];
  });
}
