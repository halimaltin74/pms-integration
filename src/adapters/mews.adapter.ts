/**
 * Mews Channel Manager API adapter.
 *
 * Room type data lives in the `spaceTypes` array of the `/getProperties` response.
 * Mews uses "Space" / "SpaceType" terminology; localised strings are objects keyed
 * by locale (e.g. { "en-US": "Deluxe Double Room" }).
 *
 * Docs: https://docs.mews.com/channel-manager-api
 */

import { z } from 'zod';
import { CanonicalRoomType } from '../types/canonical';
import { calcConfidence, generateId, logger, normaliseBedType, pickLocalised, toInt } from '../utils';

// ---------------------------------------------------------------------------
// Raw Mews schema (Zod)
// ---------------------------------------------------------------------------

const MewsSpaceTypeSchema = z.object({
  Id: z.string(),
  Names: z.record(z.string(), z.string()).optional(),
  ShortNames: z.record(z.string(), z.string()).optional(),
  Description: z.record(z.string(), z.string()).optional(),
  /** Standard occupancy */
  Capacity: z.number().optional(),
  /** Extra guests beyond standard */
  ExtraCapacity: z.number().optional(),
  SpaceCount: z.number().optional(),
  IsActive: z.boolean().optional(),
  /** Amenities are not part of the standard Channel Manager API response */
  Amenities: z.array(z.string()).optional(),
}).passthrough();

const MewsResponseSchema = z.object({
  spaceTypes: z.array(z.unknown()),
}).passthrough();

type MewsSpaceType = z.infer<typeof MewsSpaceTypeSchema>;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

// Scoreable fields: name, shortCode, description, maxOccupancy, defaultOccupancy,
// bedType, roomCount, amenities, isActive  →  9 fields
const TOTAL_SCORED_FIELDS = 9;

function parseSpaceType(raw: unknown): CanonicalRoomType | null {
  const result = MewsSpaceTypeSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('Mews: failed to parse spaceType entry', result.error.flatten());
    return null;
  }
  const s: MewsSpaceType = result.data;

  const name = pickLocalised(s.Names);
  const shortCode = pickLocalised(s.ShortNames) || name.slice(0, 4).toUpperCase();
  const description = pickLocalised(s.Description);
  const defaultOccupancy = s.Capacity != null ? toInt(s.Capacity) : 0;
  const extraCapacity = s.ExtraCapacity != null ? toInt(s.ExtraCapacity) : 0;
  const maxOccupancy = defaultOccupancy + extraCapacity;
  const roomCount = s.SpaceCount != null ? toInt(s.SpaceCount) : 0;
  const isActive = s.IsActive ?? true;
  const amenities = s.Amenities ?? [];

  // Mews doesn't expose bed type via the Channel Manager API
  if (!s.Names) logger.warn('Mews: spaceType missing Names', { id: s.Id });
  if (s.Capacity == null) logger.warn('Mews: spaceType missing Capacity', { id: s.Id });
  if (s.SpaceCount == null) logger.warn('Mews: spaceType missing SpaceCount', { id: s.Id });

  // Confidence: count how many scored fields have real data
  let populated = 0;
  if (name) populated++;
  if (shortCode) populated++;
  if (description) populated++;
  if (s.Capacity != null) populated++;           // defaultOccupancy
  if (s.ExtraCapacity != null) populated++;      // contributes to maxOccupancy
  // bedType always falls back to 'unknown' → not counted
  if (s.SpaceCount != null) populated++;         // roomCount
  if (amenities.length > 0) populated++;
  if (s.IsActive != null) populated++;

  return {
    id: generateId('mews'),
    externalId: s.Id,
    pmsSource: 'mews',
    name,
    shortCode,
    description,
    maxOccupancy,
    defaultOccupancy,
    bedType: normaliseBedType(null), // Not available in Mews Channel Manager API
    roomCount,
    amenities,
    isActive,
    confidence: calcConfidence(populated, TOTAL_SCORED_FIELDS),
    rawData: s as Record<string, unknown>,
  };
}

/**
 * Parses a raw Mews `/getProperties` API response and returns normalised room types.
 * Never throws — returns [] on unrecoverable errors.
 */
export function parseRoomTypes(rawApiResponse: unknown): CanonicalRoomType[] {
  const topLevel = MewsResponseSchema.safeParse(rawApiResponse);
  if (!topLevel.success) {
    // Maybe the caller passed the spaceTypes array directly
    if (Array.isArray(rawApiResponse)) {
      return rawApiResponse.flatMap((item) => {
        const r = parseSpaceType(item);
        return r ? [r] : [];
      });
    }
    logger.error('Mews: unexpected response shape', topLevel.error.flatten());
    return [];
  }

  return topLevel.data.spaceTypes.flatMap((item) => {
    const r = parseSpaceType(item);
    return r ? [r] : [];
  });
}
