/**
 * Electro PMS adapter.
 *
 * Electro's API spec was not provided, so this adapter is built on a
 * reasonable assumption of its field naming conventions (camelCase, similar
 * to a modern REST PMS). Update the schema below once the real spec is available.
 *
 * Expected endpoint: GET /api/v1/room-types
 * Expected envelope: { roomTypes: [...] }
 */

import { z } from 'zod';
import { CanonicalRoomType } from '../types/canonical';
import { calcConfidence, generateId, logger, normaliseBedType, toInt } from '../utils';

// ---------------------------------------------------------------------------
// Raw Electro schema (Zod)
// ---------------------------------------------------------------------------

const ElectroRoomTypeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  maxOccupancy: z.union([z.string(), z.number()]).optional(),
  defaultOccupancy: z.union([z.string(), z.number()]).optional(),
  bedType: z.string().optional(),
  totalRooms: z.union([z.string(), z.number()]).optional(),
  active: z.union([z.boolean(), z.number(), z.string()]).optional(),
  amenities: z.array(z.string()).optional(),
}).passthrough();

const ElectroResponseSchema = z.object({
  roomTypes: z.array(z.unknown()),
}).passthrough();

type ElectroRoomType = z.infer<typeof ElectroRoomTypeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const TOTAL_SCORED_FIELDS = 9;

function parseRoomType(raw: unknown): CanonicalRoomType | null {
  const result = ElectroRoomTypeSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('Electro: failed to parse roomType entry', result.error.flatten());
    return null;
  }
  const r: ElectroRoomType = result.data;

  const name = r.name ?? '';
  const shortCode = r.code ?? name.slice(0, 4).toUpperCase();
  const description = r.description ?? '';
  const maxOccupancy = r.maxOccupancy != null ? toInt(r.maxOccupancy) : 0;
  const defaultOccupancy = r.defaultOccupancy != null ? toInt(r.defaultOccupancy) : maxOccupancy;
  const roomCount = r.totalRooms != null ? toInt(r.totalRooms) : 0;
  const isActive = coerceBool(r.active);
  const amenities = r.amenities ?? [];
  const bedType = normaliseBedType(r.bedType);

  if (!r.name) logger.warn('Electro: roomType missing name', { id: r.id });
  if (r.maxOccupancy == null) logger.warn('Electro: roomType missing maxOccupancy', { id: r.id });
  if (r.totalRooms == null) logger.warn('Electro: roomType missing totalRooms', { id: r.id });

  let populated = 0;
  if (name) populated++;
  if (r.code) populated++;
  if (description) populated++;
  if (r.maxOccupancy != null) populated++;
  if (r.defaultOccupancy != null) populated++;
  if (r.bedType) populated++;
  if (r.totalRooms != null) populated++;
  if (amenities.length > 0) populated++;
  if (r.active != null) populated++;

  return {
    id: generateId('electro'),
    externalId: String(r.id),
    pmsSource: 'electro',
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
 * Parses a raw Electro room types API response and returns normalised room types.
 * Never throws — returns [] on unrecoverable errors.
 */
export function parseRoomTypes(rawApiResponse: unknown): CanonicalRoomType[] {
  const topLevel = ElectroResponseSchema.safeParse(rawApiResponse);
  if (!topLevel.success) {
    if (Array.isArray(rawApiResponse)) {
      return rawApiResponse.flatMap((item) => {
        const r = parseRoomType(item);
        return r ? [r] : [];
      });
    }
    logger.error('Electro: unexpected response shape', topLevel.error.flatten());
    return [];
  }

  return topLevel.data.roomTypes.flatMap((item) => {
    const r = parseRoomType(item);
    return r ? [r] : [];
  });
}
