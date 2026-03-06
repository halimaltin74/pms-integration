/**
 * fetchFromPMS — high-level entry point that:
 *   1. Instantiates the right HTTP client
 *   2. Calls the correct API endpoint
 *   3. Parses + normalises the raw response via the adapter layer
 *   4. Returns typed canonical entities
 *
 * Usage:
 *   const reservations = await fetchFromPMS('mews', 'reservations', credentials, { startDate: '2024-06-01' });
 */

import { PMSSource } from './types/canonical';
import { EntityType, parseFromPMS } from './parser';
import { AnyCredentials, FetchOptions, MewsCredentials, CloudbedsCredentials, OperaCredentials, HotelRunnerCredentials, ElectroCredentials } from './credentials/types';
import { CredentialStore } from './credentials/store';
import { logger } from './utils';
import { PMSApiError } from './errors';

import { MewsClient } from './clients/mews.client';
import { CloudbedsClient } from './clients/cloudbeds.client';
import { OperaClient } from './clients/opera.client';
import { HotelRunnerClient } from './clients/hotelrunner.client';
import { ElectroClient } from './clients/electro.client';

import type { CanonicalRoomType } from './types/canonical';
import type { CanonicalProperty } from './types/property.canonical';
import type { CanonicalReservation } from './types/reservation.canonical';
import type { CanonicalRate } from './types/rate.canonical';
import type { CanonicalAvailability } from './types/availability.canonical';
import type { CanonicalGuest } from './types/guest.canonical';
import type { CanonicalFolio } from './types/folio.canonical';
import type { CanonicalHousekeeping } from './types/housekeeping.canonical';

// ---------------------------------------------------------------------------
// Return type mapping
// ---------------------------------------------------------------------------

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
// Client factory
// ---------------------------------------------------------------------------

type AnyClient = MewsClient | CloudbedsClient | OperaClient | HotelRunnerClient | ElectroClient;

function buildClient(creds: AnyCredentials, store?: CredentialStore): AnyClient {
  switch (creds.pmsSource) {
    case 'mews':        return new MewsClient(creds as MewsCredentials);
    case 'cloudbeds':   return new CloudbedsClient(creds as CloudbedsCredentials, store);
    case 'opera':       return new OperaClient(creds as OperaCredentials);
    case 'hotelrunner': return new HotelRunnerClient(creds as HotelRunnerCredentials);
    case 'electro':     return new ElectroClient(creds as ElectroCredentials);
  }
}

// ---------------------------------------------------------------------------
// Dispatch: entity → client method
// ---------------------------------------------------------------------------

async function fetchRaw(client: AnyClient, entity: EntityType, options: FetchOptions): Promise<unknown> {
  switch (entity) {
    case 'roomTypes':     return client.fetchRoomTypes();
    case 'properties':   return client.fetchProperties();
    case 'reservations': return client.fetchReservations(options);
    case 'rates':        return client.fetchRates(options);
    case 'availability': return client.fetchAvailability(options);
    case 'guests':       return client.fetchGuests(options);
    case 'folios':       return client.fetchFolios(options);
    case 'housekeeping': return client.fetchHousekeeping(options);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches and normalises PMS data in one call.
 *
 * @param source      Which PMS to call
 * @param entity      Which entity type to fetch
 * @param credentials Credentials (with pmsSource discriminant)
 * @param options     Optional date range, pagination, etc.
 * @param store       Optional credential store (for persisting refreshed tokens)
 * @returns           Array of canonical entities. Empty array on failure.
 */
export async function fetchFromPMS<E extends EntityType>(
  source: PMSSource,
  entity: E,
  credentials: AnyCredentials,
  options: FetchOptions = {},
  store?: CredentialStore,
): Promise<EntityReturnMap[E][]> {
  if (credentials.pmsSource !== source) {
    logger.error(`fetchFromPMS: credential pmsSource "${credentials.pmsSource}" does not match requested source "${source}"`);
    return [];
  }

  const client = buildClient(credentials, store);

  let rawData: unknown;
  try {
    rawData = await fetchRaw(client, entity, options);
  } catch (err) {
    if (err instanceof PMSApiError) {
      logger.error(`fetchFromPMS: API error from ${source}/${entity}`, { code: err.code, status: err.statusCode, message: err.message });
    } else {
      logger.error(`fetchFromPMS: unexpected error from ${source}/${entity}`, err);
    }
    return [];
  }

  return parseFromPMS(source, entity, rawData) as EntityReturnMap[E][];
}

/**
 * Convenience: fetch using credentials from a CredentialStore.
 *
 * @param source     PMS source
 * @param entity     Entity to fetch
 * @param propertyId Property identifier in the store
 * @param store      Credential store
 * @param options    Fetch options
 */
export async function fetchFromStore<E extends EntityType>(
  source: PMSSource,
  entity: E,
  propertyId: string,
  store: CredentialStore,
  options: FetchOptions = {},
): Promise<EntityReturnMap[E][]> {
  const creds = await store.get(source, propertyId);
  if (!creds) {
    logger.error(`fetchFromStore: no credentials found for ${source}/${propertyId}`);
    return [];
  }
  return fetchFromPMS(source, entity, creds, options, store);
}

// Re-exports for convenience
export { PMSApiError };
export type { AnyCredentials, FetchOptions, EntityType };
