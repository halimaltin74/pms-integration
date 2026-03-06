import { PMSSource } from '../types/canonical';

// ---------------------------------------------------------------------------
// Per-PMS credential shapes
// ---------------------------------------------------------------------------

export interface MewsCredentials {
  /** Identifies the channel manager app — issued by Mews */
  clientToken: string;
  /** Per-property connection token */
  connectionToken: string;
  environment: 'production' | 'sandbox';
}

export interface CloudbedsCredentials {
  clientId: string;
  clientSecret: string;
  /** Current access token (populated after first auth) */
  accessToken?: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Unix ms timestamp when accessToken expires */
  tokenExpiresAt?: number;
  propertyId: string;
}

export interface OperaCredentials {
  /** e.g. "hospitality.oracle.com" */
  hostname: string;
  clientId: string;
  clientSecret: string;
  enterpriseId: string;
  hotelId: string;
  /** Current access token (populated after first auth) */
  accessToken?: string;
  tokenExpiresAt?: number;
}

export interface HotelRunnerCredentials {
  apiKey: string;
  /** Base URL — defaults to https://app.hotelrunner.com */
  baseUrl?: string;
  propertyId?: string;
}

export interface ElectroCredentials {
  apiKey: string;
  /** Full base URL of the Electro instance */
  baseUrl: string;
  propertyId?: string;
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type AnyCredentials =
  | ({ pmsSource: 'mews' } & MewsCredentials)
  | ({ pmsSource: 'cloudbeds' } & CloudbedsCredentials)
  | ({ pmsSource: 'opera' } & OperaCredentials)
  | ({ pmsSource: 'hotelrunner' } & HotelRunnerCredentials)
  | ({ pmsSource: 'electro' } & ElectroCredentials);

// ---------------------------------------------------------------------------
// Fetch options (entity-level params)
// ---------------------------------------------------------------------------

export interface FetchOptions {
  /** Start of date range — YYYY-MM-DD (for reservations, availability) */
  startDate?: string;
  /** End of date range — YYYY-MM-DD */
  endDate?: string;
  /** Override property ID when not embedded in credentials */
  propertyId?: string;
  /** Max records to return (where supported) */
  limit?: number;
  /** Cursor / page offset (where supported) */
  cursor?: string;
  /** Escape hatch: PMS-specific extra params */
  extra?: Record<string, unknown>;
}
