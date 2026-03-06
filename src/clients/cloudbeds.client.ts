/**
 * Cloudbeds PMS API v1.2 HTTP client.
 * Uses OAuth 2.0 Bearer tokens with automatic refresh.
 * Docs: https://developers.cloudbeds.com/reference/about-pms-api
 */

import axios, { AxiosInstance } from 'axios';
import { CloudbedsCredentials, FetchOptions } from '../credentials/types';
import { withRetry } from '../utils/retry';
import { PMSApiError } from '../errors';
import { tokenManager } from '../auth/token.manager';
import { CredentialStore } from '../credentials/store';

const BASE_URL = 'https://hotels.cloudbeds.com/api/v1.2';
const AUTH_URL = 'https://hotels.cloudbeds.com/oauth';

export class CloudbedsClient {
  private http: AxiosInstance;
  private creds: CloudbedsCredentials;
  private store?: CredentialStore;
  private cacheKey: string;

  constructor(creds: CloudbedsCredentials, store?: CredentialStore) {
    this.creds = creds;
    this.store = store;
    this.cacheKey = `cloudbeds:${creds.propertyId}`;
    this.http = axios.create({ baseURL: BASE_URL, timeout: 30_000 });

    // Seed token cache if we already have a valid token
    if (creds.accessToken && creds.tokenExpiresAt) {
      tokenManager.seed(this.cacheKey, creds.accessToken, creds.tokenExpiresAt);
    }

    // Attach token to every request
    this.http.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });

    // On 401: invalidate token and retry once
    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const cfg = err?.config as Record<string, unknown> | undefined;
        if (axios.isAxiosError(err) && err.response?.status === 401 && !cfg?.['_retried']) {
          tokenManager.invalidate(this.cacheKey);
          const config = { ...err.config, _retried: true } as Record<string, unknown>;
          const token = await this.getAccessToken();
          (config['headers'] as Record<string, string>)['Authorization'] = `Bearer ${token}`;
          return this.http.request(config as any);
        }
        throw err;
      },
    );
  }

  private async getAccessToken(): Promise<string> {
    return tokenManager.getToken(this.cacheKey, async () => {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        refresh_token: this.creds.refreshToken,
      });

      let data: { access_token: string; expires_in: number; refresh_token?: string };
      try {
        const res = await axios.post<typeof data>(`${AUTH_URL}/token`, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        data = res.data;
      } catch (err) {
        throw new PMSApiError('cloudbeds', 'TOKEN_REFRESH_FAILED', String(err));
      }

      // Persist updated tokens back to credential store
      if (this.store) {
        Object.assign(this.creds, {
          accessToken: data.access_token,
          tokenExpiresAt: Date.now() + data.expires_in * 1_000,
          ...(data.refresh_token && { refreshToken: data.refresh_token }),
        });
        await this.store.update({ ...this.creds, pmsSource: 'cloudbeds', propertyId: this.creds.propertyId });
      }

      return { token: data.access_token, expiresIn: data.expires_in };
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    return withRetry(async () => { try {
      const { data } = await this.http.get<T>(path, {
        params: { propertyID: this.creds.propertyId, ...params },
      });
      return data;
    } catch (err) { throw this.wrapError(err); }});
  }

  private wrapError(err: unknown): PMSApiError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return new PMSApiError('cloudbeds', 'AUTH_FAILED', err.message, status);
      if (status === 429) return new PMSApiError('cloudbeds', 'RATE_LIMITED', 'Too many requests', status);
      if (status && status >= 500) return new PMSApiError('cloudbeds', 'SERVER_ERROR', err.message, status);
      if (!err.response) return new PMSApiError('cloudbeds', 'NETWORK_ERROR', err.message);
    }
    return new PMSApiError('cloudbeds', 'INVALID_RESPONSE', String(err));
  }

  async fetchProperties(): Promise<unknown> {
    return this.get('/getPropertyInfo');
  }

  async fetchRoomTypes(): Promise<unknown> {
    return this.get('/getRoomTypes');
  }

  async fetchReservations(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/getReservations', {
      pageNumber: 1,
      pageSize: options.limit ?? 100,
      ...(options.startDate && { checkIn: options.startDate }),
      ...(options.endDate && { checkOut: options.endDate }),
    });
  }

  async fetchRates(): Promise<unknown> {
    return this.get('/getRatePlans');
  }

  async fetchAvailability(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/getAvailability', {
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
    });
  }

  async fetchGuests(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/getGuestList', {
      pageNumber: 1,
      pageSize: options.limit ?? 100,
    });
  }

  async fetchFolios(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/getFolios', {
      pageNumber: 1,
      pageSize: options.limit ?? 100,
    });
  }

  async fetchHousekeeping(_options: FetchOptions = {}): Promise<unknown> {
    return this.get('/getHousekeepingStatus');
  }
}
