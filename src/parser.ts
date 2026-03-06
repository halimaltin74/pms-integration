/**
 * Main entry point for the PMS integration layer.
 *
 * Usage:
 *   import { parseFromPMS, detectPMSFormat } from './parser';
 *
 *   const rooms = parseFromPMS('mews', rawApiResponse);
 *   // or, when source is unknown:
 *   const source = detectPMSFormat(rawApiResponse);
 *   if (source) { const rooms = parseFromPMS(source, rawApiResponse); }
 */

import { CanonicalRoomType, PMSSource } from './types/canonical';
import { logger } from './utils';

import * as mewsAdapter from './adapters/mews.adapter';
import * as cloudbedsAdapter from './adapters/cloudbeds.adapter';
import * as operaAdapter from './adapters/opera.adapter';
import * as hotelrunnerAdapter from './adapters/hotelrunner.adapter';
import * as electroAdapter from './adapters/electro.adapter';

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

const ADAPTERS: Record<PMSSource, { parseRoomTypes: (raw: unknown) => CanonicalRoomType[] }> = {
  mews: mewsAdapter,
  cloudbeds: cloudbedsAdapter,
  opera: operaAdapter,
  hotelrunner: hotelrunnerAdapter,
  electro: electroAdapter,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Routes `rawData` to the appropriate PMS adapter and returns normalised room types.
 *
 * @param source  Which PMS the data comes from.
 * @param rawData The raw API response payload (will be validated internally).
 * @returns       Array of CanonicalRoomType objects. Empty array on failure.
 */
export function parseFromPMS(source: PMSSource, rawData: unknown): CanonicalRoomType[] {
  const adapter = ADAPTERS[source];
  if (!adapter) {
    logger.error(`parseFromPMS: no adapter registered for source "${source}"`);
    return [];
  }

  try {
    return adapter.parseRoomTypes(rawData);
  } catch (err) {
    logger.error(`parseFromPMS: unhandled error in ${source} adapter`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auto-detection heuristics
// ---------------------------------------------------------------------------

/**
 * A detection rule checks whether a raw payload "looks like" a given PMS.
 * Higher `weight` = checked first. The first passing rule wins.
 */
type DetectionRule = {
  source: PMSSource;
  /** Higher = higher priority */
  weight: number;
  detect: (data: unknown) => boolean;
};

/**
 * Safely retrieves a nested value from an unknown object without throwing.
 */
function safeGet(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function hasKey(obj: unknown, key: string): boolean {
  return obj != null && typeof obj === 'object' && key in (obj as object);
}

function firstArrayItem(data: unknown): unknown {
  if (Array.isArray(data) && data.length > 0) return data[0];
  return undefined;
}

const DETECTION_RULES: DetectionRule[] = [
  // ── Mews ─────────────────────────────────────────────────────────────────
  {
    source: 'mews',
    weight: 10,
    detect(data) {
      // Top-level envelope
      if (hasKey(data, 'spaceTypes')) return true;
      // Array of space types
      const item = firstArrayItem(data);
      if (item && (hasKey(item, 'SpaceCount') || hasKey(item, 'ExtraCapacity'))) return true;
      if (item && hasKey(item, 'Id') && hasKey(item, 'Names') && hasKey(item, 'Capacity')) return true;
      return false;
    },
  },

  // ── Cloudbeds ─────────────────────────────────────────────────────────────
  {
    source: 'cloudbeds',
    weight: 10,
    detect(data) {
      if (hasKey(safeGet(data, 'data'), 'roomTypeID') || hasKey(data, 'roomTypeID')) return true;
      // Array
      const item = firstArrayItem(data) ??
        firstArrayItem(safeGet(data, 'data'));
      if (item && hasKey(item, 'roomTypeID')) return true;
      if (item && hasKey(item, 'roomTypeName') && hasKey(item, 'maxGuests')) return true;
      return false;
    },
  },

  // ── Opera Cloud ───────────────────────────────────────────────────────────
  {
    source: 'opera',
    weight: 10,
    detect(data) {
      // OHIP nested envelope
      if (safeGet(data, 'roomTypes', 'roomTypeInfo')) return true;
      const item = firstArrayItem(data) ??
        firstArrayItem(safeGet(data, 'roomTypes', 'roomTypeInfo'));
      if (item && hasKey(item, 'activeFlag') && hasKey(item, 'roomsInInventory')) return true;
      if (item && hasKey(item, 'roomType') && hasKey(item, 'roomClass')) return true;
      return false;
    },
  },

  // ── HotelRunner ──────────────────────────────────────────────────────────
  {
    source: 'hotelrunner',
    weight: 10,
    detect(data) {
      if (safeGet(data, 'data', 'room_types')) return true;
      const item = firstArrayItem(data) ??
        firstArrayItem(safeGet(data, 'data', 'room_types'));
      if (item && hasKey(item, 'room_type_id')) return true;
      if (item && hasKey(item, 'room_count') && hasKey(item, 'capacity') && !hasKey(item, 'roomType')) return true;
      return false;
    },
  },

  // ── Electro ──────────────────────────────────────────────────────────────
  {
    source: 'electro',
    weight: 5, // lower priority — field names are more generic
    detect(data) {
      if (hasKey(data, 'roomTypes') && !safeGet(data, 'roomTypes', 'roomTypeInfo')) return true;
      const item = firstArrayItem(safeGet(data, 'roomTypes')) ?? firstArrayItem(data);
      if (item && hasKey(item, 'totalRooms') && hasKey(item, 'code')) return true;
      return false;
    },
  },
];

// Sort descending by weight so highest-priority rules are checked first
DETECTION_RULES.sort((a, b) => b.weight - a.weight);

/**
 * Attempts to auto-detect which PMS a raw payload came from.
 *
 * @param rawData  The raw API response (envelope or array).
 * @returns        The detected PMSSource, or `null` if undetermined.
 */
export function detectPMSFormat(rawData: unknown): PMSSource | null {
  for (const rule of DETECTION_RULES) {
    try {
      if (rule.detect(rawData)) return rule.source;
    } catch {
      // defensive: detection rules must not throw
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { CanonicalRoomType, PMSSource };
export { CanonicalRoomTypeSchema, PMSSourceSchema, BedTypeSchema } from './types/canonical';
