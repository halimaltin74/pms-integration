/**
 * Main entry point for the PMS integration layer.
 *
 * Usage:
 *   import { parseFromPMS, detectPMSFormat } from './parser';
 *
 *   const rooms        = parseFromPMS('mews', 'roomTypes', rawData);
 *   const properties   = parseFromPMS('cloudbeds', 'properties', rawData);
 *   const reservations = parseFromPMS('opera', 'reservations', rawData);
 *   const rates        = parseFromPMS('hotelrunner', 'rates', rawData);
 *   const availability = parseFromPMS('electro', 'availability', rawData);
 *   const guests       = parseFromPMS('mews', 'guests', rawData);
 *
 *   // Auto-detect source:
 *   const source = detectPMSFormat(rawData);
 *   if (source) { ... }
 */

import { CanonicalRoomType, PMSSource } from './types/canonical';
import { CanonicalProperty } from './types/property.canonical';
import { CanonicalReservation } from './types/reservation.canonical';
import { CanonicalRate } from './types/rate.canonical';
import { CanonicalAvailability } from './types/availability.canonical';
import { CanonicalGuest } from './types/guest.canonical';
import { CanonicalFolio } from './types/folio.canonical';
import { CanonicalHousekeeping } from './types/housekeeping.canonical';
import { logger } from './utils';

// Room type adapters (existing)
import * as mewsRooms from './adapters/mews.adapter';
import * as cloudbedsRooms from './adapters/cloudbeds.adapter';
import * as operaRooms from './adapters/opera.adapter';
import * as hotelrunnerRooms from './adapters/hotelrunner.adapter';
import * as electroRooms from './adapters/electro.adapter';

// Property adapters
import * as mewsProperty from './adapters/mews.property.adapter';
import * as cloudbedsProperty from './adapters/cloudbeds.property.adapter';
import * as operaProperty from './adapters/opera.property.adapter';
import * as hotelrunnerProperty from './adapters/hotelrunner.property.adapter';
import * as electroProperty from './adapters/electro.property.adapter';

// Reservation adapters
import * as mewsReservation from './adapters/mews.reservation.adapter';
import * as cloudbedsReservation from './adapters/cloudbeds.reservation.adapter';
import * as operaReservation from './adapters/opera.reservation.adapter';
import * as hotelrunnerReservation from './adapters/hotelrunner.reservation.adapter';
import * as electroReservation from './adapters/electro.reservation.adapter';

// Rate adapters
import * as mewsRate from './adapters/mews.rate.adapter';
import * as cloudbedsRate from './adapters/cloudbeds.rate.adapter';
import * as operaRate from './adapters/opera.rate.adapter';
import * as hotelrunnerRate from './adapters/hotelrunner.rate.adapter';
import * as electroRate from './adapters/electro.rate.adapter';

// Availability adapters
import * as mewsAvailability from './adapters/mews.availability.adapter';
import * as cloudbedsAvailability from './adapters/cloudbeds.availability.adapter';
import * as operaAvailability from './adapters/opera.availability.adapter';
import * as hotelrunnerAvailability from './adapters/hotelrunner.availability.adapter';
import * as electroAvailability from './adapters/electro.availability.adapter';

// Guest adapters
import * as mewsGuest from './adapters/mews.guest.adapter';
import * as cloudbedsGuest from './adapters/cloudbeds.guest.adapter';
import * as operaGuest from './adapters/opera.guest.adapter';
import * as hotelrunnerGuest from './adapters/hotelrunner.guest.adapter';
import * as electroGuest from './adapters/electro.guest.adapter';

// Folio adapters
import * as mewsFolio from './adapters/mews.folio.adapter';
import * as cloudbedsFolio from './adapters/cloudbeds.folio.adapter';
import * as operaFolio from './adapters/opera.folio.adapter';
import * as hotelrunnerFolio from './adapters/hotelrunner.folio.adapter';
import * as electroFolio from './adapters/electro.folio.adapter';

// Housekeeping adapters
import * as mewsHousekeeping from './adapters/mews.housekeeping.adapter';
import * as cloudbedsHousekeeping from './adapters/cloudbeds.housekeeping.adapter';
import * as operaHousekeeping from './adapters/opera.housekeeping.adapter';
import * as hotelrunnerHousekeeping from './adapters/hotelrunner.housekeeping.adapter';
import * as electroHousekeeping from './adapters/electro.housekeeping.adapter';

// ---------------------------------------------------------------------------
// Entity type definitions
// ---------------------------------------------------------------------------

export type EntityType = 'roomTypes' | 'properties' | 'reservations' | 'rates' | 'availability' | 'guests' | 'folios' | 'housekeeping';

// Return type mapping — gives TypeScript callers full type inference
type EntityReturnMap = {
  roomTypes: CanonicalRoomType;
  properties: CanonicalProperty;
  reservations: CanonicalReservation;
  rates: CanonicalRate;
  availability: CanonicalAvailability;
  guests: CanonicalGuest;
  folios: CanonicalFolio;
  housekeeping: CanonicalHousekeeping;
};

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

type AdapterFn<T> = (raw: unknown) => T[];

interface PMSAdapters {
  roomTypes: AdapterFn<CanonicalRoomType>;
  properties: AdapterFn<CanonicalProperty>;
  reservations: AdapterFn<CanonicalReservation>;
  rates: AdapterFn<CanonicalRate>;
  availability: AdapterFn<CanonicalAvailability>;
  guests: AdapterFn<CanonicalGuest>;
  folios: AdapterFn<CanonicalFolio>;
  housekeeping: AdapterFn<CanonicalHousekeeping>;
}

const ADAPTERS: Record<PMSSource, PMSAdapters> = {
  mews: {
    roomTypes:     mewsRooms.parseRoomTypes,
    properties:    mewsProperty.parseProperties,
    reservations:  mewsReservation.parseReservations,
    rates:         mewsRate.parseRates,
    availability:  mewsAvailability.parseAvailability,
    guests:        mewsGuest.parseGuests,
    folios:        mewsFolio.parseFolios,
    housekeeping:  mewsHousekeeping.parseHousekeeping,
  },
  cloudbeds: {
    roomTypes:     cloudbedsRooms.parseRoomTypes,
    properties:    cloudbedsProperty.parseProperties,
    reservations:  cloudbedsReservation.parseReservations,
    rates:         cloudbedsRate.parseRates,
    availability:  cloudbedsAvailability.parseAvailability,
    guests:        cloudbedsGuest.parseGuests,
    folios:        cloudbedsFolio.parseFolios,
    housekeeping:  cloudbedsHousekeeping.parseHousekeeping,
  },
  opera: {
    roomTypes:     operaRooms.parseRoomTypes,
    properties:    operaProperty.parseProperties,
    reservations:  operaReservation.parseReservations,
    rates:         operaRate.parseRates,
    availability:  operaAvailability.parseAvailability,
    guests:        operaGuest.parseGuests,
    folios:        operaFolio.parseFolios,
    housekeeping:  operaHousekeeping.parseHousekeeping,
  },
  hotelrunner: {
    roomTypes:     hotelrunnerRooms.parseRoomTypes,
    properties:    hotelrunnerProperty.parseProperties,
    reservations:  hotelrunnerReservation.parseReservations,
    rates:         hotelrunnerRate.parseRates,
    availability:  hotelrunnerAvailability.parseAvailability,
    guests:        hotelrunnerGuest.parseGuests,
    folios:        hotelrunnerFolio.parseFolios,
    housekeeping:  hotelrunnerHousekeeping.parseHousekeeping,
  },
  electro: {
    roomTypes:     electroRooms.parseRoomTypes,
    properties:    electroProperty.parseProperties,
    reservations:  electroReservation.parseReservations,
    rates:         electroRate.parseRates,
    availability:  electroAvailability.parseAvailability,
    guests:        electroGuest.parseGuests,
    folios:        electroFolio.parseFolios,
    housekeeping:  electroHousekeeping.parseHousekeeping,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseFromPMS<E extends EntityType>(
  source: PMSSource,
  entity: E,
  rawData: unknown,
): EntityReturnMap[E][] {
  const pmsAdapters = ADAPTERS[source];
  if (!pmsAdapters) {
    logger.error(`parseFromPMS: no adapter registered for source "${source}"`);
    return [];
  }
  const fn = pmsAdapters[entity];
  if (!fn) {
    logger.error(`parseFromPMS: no "${entity}" adapter for source "${source}"`);
    return [];
  }
  try {
    return (fn as AdapterFn<EntityReturnMap[E]>)(rawData);
  } catch (err) {
    logger.error(`parseFromPMS: unhandled error in ${source}/${entity} adapter`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auto-detection heuristics
// ---------------------------------------------------------------------------

type DetectionRule = {
  source: PMSSource;
  weight: number;
  detect: (data: unknown) => boolean;
};

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
  {
    source: 'mews',
    weight: 10,
    detect(data) {
      if (hasKey(data, 'spaceTypes') || hasKey(data, 'hotels') || hasKey(data, 'customers') || hasKey(data, 'reservations') && hasKey(safeGet(data, 'reservations', '0'), 'StartUtc')) return true;
      const item = firstArrayItem(data);
      if (item && (hasKey(item, 'SpaceCount') || hasKey(item, 'ExtraCapacity'))) return true;
      if (item && hasKey(item, 'Id') && hasKey(item, 'Names') && hasKey(item, 'Capacity')) return true;
      if (item && hasKey(item, 'StartUtc') && hasKey(item, 'EndUtc') && hasKey(item, 'AdultCount')) return true;
      if (item && hasKey(item, 'NationalityCode') && hasKey(item, 'BirthDateUtc')) return true;
      return false;
    },
  },
  {
    source: 'cloudbeds',
    weight: 10,
    detect(data) {
      if (hasKey(data, 'roomTypeID') || hasKey(data, 'reservationID') || hasKey(data, 'guestID')) return true;
      const item = firstArrayItem(data) ?? firstArrayItem(safeGet(data, 'data'));
      if (!item) {
        if (hasKey(safeGet(data, 'data'), 'propertyID') || hasKey(safeGet(data, 'data'), 'propertyName')) return true;
      }
      if (item && (hasKey(item, 'roomTypeID') || hasKey(item, 'reservationID') || hasKey(item, 'guestID'))) return true;
      if (item && hasKey(item, 'roomTypeName') && hasKey(item, 'maxGuests')) return true;
      return false;
    },
  },
  {
    source: 'opera',
    weight: 10,
    detect(data) {
      if (safeGet(data, 'roomTypes', 'roomTypeInfo')) return true;
      if (safeGet(data, 'reservations', 'reservation')) return true;
      if (safeGet(data, 'ratePlans', 'ratePlan')) return true;
      if (safeGet(data, 'profiles', 'profile')) return true;
      if (hasKey(data, 'hotelInfo')) return true;
      if (hasKey(data, 'availability')) return true;
      const item = firstArrayItem(data) ?? firstArrayItem(safeGet(data, 'availability'));
      if (item && hasKey(item, 'activeFlag') && hasKey(item, 'roomsInInventory')) return true;
      if (item && hasKey(item, 'roomType') && hasKey(item, 'roomClass')) return true;
      if (item && hasKey(item, 'housekeepingStatus')) return true;
      return false;
    },
  },
  {
    source: 'hotelrunner',
    weight: 10,
    detect(data) {
      if (safeGet(data, 'data', 'room_types')) return true;
      if (safeGet(data, 'data', 'reservations')) return true;
      if (safeGet(data, 'data', 'rate_plans')) return true;
      if (safeGet(data, 'data', 'guests')) return true;
      if (safeGet(data, 'data', 'property') && hasKey(safeGet(data, 'data', 'property'), 'property_id')) return true;
      if (safeGet(data, 'data', 'availability')) return true;
      const item = firstArrayItem(data) ?? firstArrayItem(safeGet(data, 'data', 'room_types'));
      if (item && hasKey(item, 'room_type_id')) return true;
      if (item && hasKey(item, 'reservation_id')) return true;
      return false;
    },
  },
  {
    source: 'electro',
    weight: 5,
    detect(data) {
      if (hasKey(data, 'roomTypes') && !safeGet(data, 'roomTypes', 'roomTypeInfo')) return true;
      if (hasKey(data, 'reservations') && !safeGet(data, 'reservations', 'reservation')) return true;
      if (hasKey(data, 'rates') || hasKey(data, 'guests') || hasKey(data, 'properties')) return true;
      const item = firstArrayItem(safeGet(data, 'roomTypes')) ?? firstArrayItem(data);
      if (item && hasKey(item, 'totalRooms') && hasKey(item, 'code')) return true;
      if (item && hasKey(item, 'checkIn') && hasKey(item, 'checkOut') && hasKey(item, 'guestId')) return true;
      return false;
    },
  },
];

DETECTION_RULES.sort((a, b) => b.weight - a.weight);

export function detectPMSFormat(rawData: unknown): PMSSource | null {
  for (const rule of DETECTION_RULES) {
    try {
      if (rule.detect(rawData)) return rule.source;
    } catch { /* defensive */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { CanonicalRoomType, PMSSource };
export type { CanonicalProperty };
export type { CanonicalReservation, ReservationStatus } from './types/reservation.canonical';
export type { CanonicalRate, MealPlan } from './types/rate.canonical';
export type { CanonicalAvailability } from './types/availability.canonical';
export type { CanonicalGuest, Gender, IdType } from './types/guest.canonical';
export type { CanonicalFolio, FolioItem, FolioItemType, FolioStatus } from './types/folio.canonical';
export type { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from './types/housekeeping.canonical';
export { CanonicalRoomTypeSchema, PMSSourceSchema, BedTypeSchema } from './types/canonical';
