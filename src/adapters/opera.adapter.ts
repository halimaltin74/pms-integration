/**
 * Oracle OPERA Cloud (OHIP) adapter.
 *
 * Room types come from `GET /rsv/v0/hotels/{hotelId}/roomTypes`.
 * The response envelope is `{ roomTypes: { roomTypeInfo: [...] } }`.
 * Bed types use OTA numeric codes (handled by normaliseBedType).
 *
 * Docs: https://docs.oracle.com/cd/F29336_01/doc.201/f27480/
 */

import { z } from 'zod';
import { CanonicalRoomType } from '../types/canonical';
import { calcConfidence, generateId, logger, normaliseBedType, toInt } from '../utils';

// ---------------------------------------------------------------------------
// Raw Opera schema (Zod)
// ---------------------------------------------------------------------------

const OperaRoomTypeSchema = z.object({
  /** Short code that is the PMS primary key (e.g. "DD") */
  roomType: z.string(),
  roomTypeDescription: z.string().optional(),
  roomClass: z.string().optional(),
  maxOccupancy: z.union([z.string(), z.number()]).optional(),
  /** Can be an OTA numeric code string or free-text label */
  bedType: z.union([z.string(), z.number()]).optional(),
  roomsInInventory: z.union([z.string(), z.number()]).optional(),
  /** "Y" | "N" */
  activeFlag: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  defaultOccupancy: z.union([z.string(), z.number()]).optional(),
}).passthrough();

/**
 * OHIP wraps the array in a nested structure; we also accept a plain array.
 */
const OperaResponseSchema = z.object({
  roomTypes: z.object({
    roomTypeInfo: z.array(z.unknown()),
  }),
}).passthrough();

type OperaRoomType = z.infer<typeof OperaRoomTypeSchema>;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const TOTAL_SCORED_FIELDS = 9;

function parseRoomType(raw: unknown): CanonicalRoomType | null {
  const result = OperaRoomTypeSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('Opera: failed to parse roomType entry', result.error.flatten());
    return null;
  }
  const r: OperaRoomType = result.data;

  // roomType code doubles as both the external ID and the short code
  const shortCode = r.roomType;
  const name = r.roomTypeDescription ?? shortCode;
  const description = r.roomClass
    ? `${r.roomClass}${r.roomTypeDescription ? ' – ' + r.roomTypeDescription : ''}`
    : (r.roomTypeDescription ?? '');
  const maxOccupancy = r.maxOccupancy != null ? toInt(r.maxOccupancy) : 0;
  const defaultOccupancy = r.defaultOccupancy != null ? toInt(r.defaultOccupancy) : maxOccupancy;
  const roomCount = r.roomsInInventory != null ? toInt(r.roomsInInventory) : 0;
  const isActive = r.activeFlag ? r.activeFlag.toUpperCase() === 'Y' : true;
  const amenities = r.amenities ?? [];
  const bedType = normaliseBedType(r.bedType);

  if (!r.roomTypeDescription) logger.warn('Opera: roomType missing roomTypeDescription', { code: r.roomType });
  if (r.maxOccupancy == null) logger.warn('Opera: roomType missing maxOccupancy', { code: r.roomType });
  if (r.roomsInInventory == null) logger.warn('Opera: roomType missing roomsInInventory', { code: r.roomType });
  if (!r.bedType) logger.warn('Opera: roomType missing bedType', { code: r.roomType });

  let populated = 0;
  if (name && name !== shortCode) populated++;          // real name beyond code
  if (shortCode) populated++;
  if (r.roomTypeDescription || r.roomClass) populated++;
  if (r.maxOccupancy != null) populated++;
  if (r.defaultOccupancy != null) populated++;
  if (r.bedType) populated++;
  if (r.roomsInInventory != null) populated++;
  if (amenities.length > 0) populated++;
  if (r.activeFlag != null) populated++;

  return {
    id: generateId('opera'),
    externalId: r.roomType,
    pmsSource: 'opera',
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
 * Parses a raw Oracle OPERA Cloud roomTypes API response and returns normalised room types.
 * Never throws — returns [] on unrecoverable errors.
 */
export function parseRoomTypes(rawApiResponse: unknown): CanonicalRoomType[] {
  const topLevel = OperaResponseSchema.safeParse(rawApiResponse);
  if (!topLevel.success) {
    // Accept a flat array passed directly
    if (Array.isArray(rawApiResponse)) {
      return rawApiResponse.flatMap((item) => {
        const r = parseRoomType(item);
        return r ? [r] : [];
      });
    }
    logger.error('Opera: unexpected response shape', topLevel.error.flatten());
    return [];
  }

  return topLevel.data.roomTypes.roomTypeInfo.flatMap((item) => {
    const r = parseRoomType(item);
    return r ? [r] : [];
  });
}
