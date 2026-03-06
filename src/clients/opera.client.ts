/**
 * Oracle OPERA Cloud (OHIP) HTTP client.
 * Uses OAuth 2.0 client_credentials flow — tokens expire after ~1 hour.
 * Docs: https://docs.oracle.com/cd/F29336_01/doc.201/f27480/
 */

import axios, { AxiosInstance } from 'axios';
import { OperaCredentials, FetchOptions } from '../credentials/types';
import { PMSApiError } from '../errors';
import { tokenManager } from '../auth/token.manager';

export class OperaClient {
  private http: AxiosInstance;
  private creds: OperaCredentials;
  private cacheKey: string;

  constructor(creds: OperaCredentials) {
    this.creds = creds;
    this.cacheKey = `opera:${creds.hotelId}`;
    this.http = axios.create({
      baseURL: `https://${creds.hostname}`,
      timeout: 30_000,
      headers: {
        'x-app-key': creds.clientId,
        'x-hotelid': creds.hotelId,
      },
    });

    if (creds.accessToken && creds.tokenExpiresAt) {
      tokenManager.seed(this.cacheKey, creds.accessToken, creds.tokenExpiresAt);
    }

    this.http.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });

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
        grant_type: 'client_credentials',
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
      });

      let data: { access_token: string; expires_in: number };
      try {
        const res = await axios.post<typeof data>(
          `https://${this.creds.hostname}/oauth/v1/tokens`,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'x-app-key': this.creds.clientId,
              'x-idtenantname': this.creds.enterpriseId,
            },
          },
        );
        data = res.data;
      } catch (err) {
        throw new PMSApiError('opera', 'TOKEN_REFRESH_FAILED', String(err));
      }

      return { token: data.access_token, expiresIn: data.expires_in };
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const { data } = await this.http.get<T>(path, { params });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  private wrapError(err: unknown): PMSApiError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return new PMSApiError('opera', 'AUTH_FAILED', err.message, status);
      if (status === 404) return new PMSApiError('opera', 'NOT_FOUND', err.message, status);
      if (status === 429) return new PMSApiError('opera', 'RATE_LIMITED', 'Too many requests', status);
      if (status && status >= 500) return new PMSApiError('opera', 'SERVER_ERROR', err.message, status);
      if (!err.response) return new PMSApiError('opera', 'NETWORK_ERROR', err.message);
    }
    return new PMSApiError('opera', 'INVALID_RESPONSE', String(err));
  }

  private get hotelId(): string { return this.creds.hotelId; }

  async fetchProperties(): Promise<unknown> {
    return this.get(`/hsk/v0/hotels/${this.hotelId}`);
  }

  async fetchRoomTypes(): Promise<unknown> {
    return this.get(`/rsv/v0/hotels/${this.hotelId}/roomTypes`);
  }

  async fetchReservations(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/rsv/v0/hotels/${this.hotelId}/reservations`, {
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
      limit: options.limit ?? 100,
    });
  }

  async fetchRates(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/rtp/v0/hotels/${this.hotelId}/ratePlans`, options.extra);
  }

  async fetchAvailability(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/rsv/v0/hotels/${this.hotelId}/availability`, {
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
    });
  }

  async fetchGuests(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/crm/v0/hotels/${this.hotelId}/profiles`, {
      profileType: 'GUEST',
      limit: options.limit ?? 100,
    });
  }
}
