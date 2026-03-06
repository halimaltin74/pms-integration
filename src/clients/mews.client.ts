/**
 * Mews Channel Manager API HTTP client.
 * All endpoints use POST with auth tokens in the JSON body.
 * Docs: https://docs.mews.com/channel-manager-api
 */

import axios, { AxiosInstance } from 'axios';
import { MewsCredentials } from '../credentials/types';
import { PMSApiError } from '../errors';
import { FetchOptions } from '../credentials/types';

const BASE_URLS = {
  production: 'https://api.mews.com',
  sandbox: 'https://api.mews-demo.com',
} as const;

export class MewsClient {
  private http: AxiosInstance;
  private auth: { clientToken: string; connectionToken: string };

  constructor(creds: MewsCredentials) {
    this.auth = { clientToken: creds.clientToken, connectionToken: creds.connectionToken };
    this.http = axios.create({
      baseURL: BASE_URLS[creds.environment],
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    try {
      const { data } = await this.http.post<T>(path, { ...this.auth, ...body });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  private wrapError(err: unknown): PMSApiError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return new PMSApiError('mews', 'AUTH_FAILED', err.message, status, err.response?.data);
      if (status === 429) return new PMSApiError('mews', 'RATE_LIMITED', 'Too many requests', status);
      if (status && status >= 500) return new PMSApiError('mews', 'SERVER_ERROR', err.message, status, err.response?.data);
      if (!err.response) return new PMSApiError('mews', 'NETWORK_ERROR', err.message);
    }
    return new PMSApiError('mews', 'INVALID_RESPONSE', String(err));
  }

  async fetchProperties(): Promise<unknown> {
    return this.post('/api/channelManager/v1/getProperties', {});
  }

  async fetchReservations(options: FetchOptions = {}): Promise<unknown> {
    const now = new Date();
    const startUtc = options.startDate
      ? new Date(options.startDate).toISOString()
      : new Date(now.getTime() - 7 * 86400_000).toISOString();
    const endUtc = options.endDate
      ? new Date(options.endDate).toISOString()
      : now.toISOString();

    return this.post('/api/channelManager/v1/getReservations', { startUtc, endUtc });
  }

  async fetchRates(): Promise<unknown> {
    return this.post('/api/channelManager/v1/getRates', {});
  }

  async fetchAvailability(options: FetchOptions = {}): Promise<unknown> {
    const startUtc = options.startDate
      ? new Date(options.startDate).toISOString()
      : new Date().toISOString();
    const endUtc = options.endDate
      ? new Date(options.endDate).toISOString()
      : new Date(Date.now() + 90 * 86400_000).toISOString();

    return this.post('/api/channelManager/v1/getAvailability', { startUtc, endUtc });
  }

  async fetchGuests(options: FetchOptions = {}): Promise<unknown> {
    const body: Record<string, unknown> = {};
    if (options.limit) body['limitation'] = { count: options.limit, cursor: options.cursor };
    return this.post('/api/channelManager/v1/getCustomers', body);
  }

  /** Room types are part of the getProperties response */
  async fetchRoomTypes(): Promise<unknown> {
    return this.fetchProperties();
  }
}
