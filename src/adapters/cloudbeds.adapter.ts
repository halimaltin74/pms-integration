/**
 * Cloudbeds PMS API v1.2 adapter.
 *
 * Room types are returned from `GET /v1.2/getRoomTypes`.
 * The response envelope wraps data in `{ success: true, data: [...] }`.
 *
 * Docs: https://developers.cloudbeds.com/reference/about-pms-api
 */

import { z } from 'zod';
import { CanonicalRoomType } from '../types/canonical';
import { calcConfidence, generateId, logger, normaliseBedType, toInt } from '../utils';

// ---------------------------------------------------------------------------
// Raw Cloudbeds schema (Zod)
// ---------------------------------------------------------------------------

const CloudbedsRoomTypeSchema = z.object({
  roomTypeID: z.union([z.string(), z.number()]),
  roomTypeName: z.string().optional(),
  roomTypeShortName: z.string().optional(),
  maxGuests: z.union([z.string(), z.number()]).optional(),
  roomsCount: z.union([z.string(), z.number()]).optional(),
  roomTypeDescription: z.string().optional(),
  isActive: z.union([z.boolean(), z.number(), z.string()]).optional(),
  bedType: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  /** Cloudbeds doesn't have a separate defaultOccupancy; use maxGuests */
  defaultOccupancy: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const CloudbedsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
}).passthrough();

type CloudbedsRoomType = z.infer<typeof CloudbedsRoomTypeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce various truthy representations to boolean */
function coerceBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

// Scoreable: name, shortCode, description, maxOccupancy, defaultOccupancy,
//            bedType, roomCount, amenities, isActive  → 9 fields
const TOTAL_SCORED_FIELDS = 9;

function parseRoomType(raw: unknown): CanonicalRoomType | null {
  const result = CloudbedsRoomTypeSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('Cloudbeds: failed to parse roomType entry', result.error.flatten());
    return null;
  }
  const r: CloudbedsRoomType = result.data;

  const name = r.roomTypeName ?? '';
  const shortCode = r.roomTypeShortName ?? name.slice(0, 4).toUpperCase();
  const description = r.roomTypeDescription ?? '';
  const maxOccupancy = r.maxGuests != null ? toInt(r.maxGuests) : 0;
  // Cloudbeds doesn't expose defaultOccupancy separately; treat maxGuests as default too
  const defaultOccupancy = r.defaultOccupancy != null ? toInt(r.defaultOccupancy) : maxOccupancy;
  const roomCount = r.roomsCount != null ? toInt(r.roomsCount) : 0;
  const isActive = coerceBool(r.isActive);
  const amenities = r.amenities ?? [];
  const bedType = normaliseBedType(r.bedType);

  if (!r.roomTypeName) logger.warn('Cloudbeds: roomType missing roomTypeName', { id: r.roomTypeID });
  if (r.maxGuests == null) logger.warn('Cloudbeds: roomType missing maxGuests', { id: r.roomTypeID });
  if (r.roomsCount == null) logger.warn('Cloudbeds: roomType missing roomsCount', { id: r.roomTypeID });

  let populated = 0;
  if (name) populated++;
  if (r.roomTypeShortName) populated++;
  if (description) populated++;
  if (r.maxGuests != null) populated++;
  if (r.defaultOccupancy != null) populated++;
  if (r.bedType) populated++;
  if (r.roomsCount != null) populated++;
  if (amenities.length > 0) populated++;
  if (r.isActive != null) populated++;

  return {
    id: generateId('cloudbeds'),
    externalId: String(r.roomTypeID),
    pmsSource: 'cloudbeds',
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
 * Parses a raw Cloudbeds `getRoomTypes` API response and returns normalised room types.
 * Never throws — returns [] on unrecoverable errors.
 */
export function parseRoomTypes(rawApiResponse: unknown): CanonicalRoomType[] {
  const topLevel = CloudbedsResponseSchema.safeParse(rawApiResponse);
  if (!topLevel.success) {
    // Maybe the caller passed the data array directly
    if (Array.isArray(rawApiResponse)) {
      return rawApiResponse.flatMap((item) => {
        const r = parseRoomType(item);
        return r ? [r] : [];
      });
    }
    logger.error('Cloudbeds: unexpected response shape', topLevel.error.flatten());
    return [];
  }

  return topLevel.data.data.flatMap((item) => {
    const r = parseRoomType(item);
    return r ? [r] : [];
  });
}
