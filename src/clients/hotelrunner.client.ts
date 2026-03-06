/**
 * HotelRunner REST API HTTP client.
 * Uses a static API key in the Authorization header.
 */

import axios, { AxiosInstance } from 'axios';
import { withRetry } from '../utils/retry';
import { HotelRunnerCredentials, FetchOptions } from '../credentials/types';
import { PMSApiError } from '../errors';

const DEFAULT_BASE_URL = 'https://app.hotelrunner.com';

export class HotelRunnerClient {
  private http: AxiosInstance;
  private propertyId: string;

  constructor(creds: HotelRunnerCredentials) {
    this.propertyId = creds.propertyId ?? '';
    this.http = axios.create({
      baseURL: creds.baseUrl ?? DEFAULT_BASE_URL,
      timeout: 30_000,
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    return withRetry(async () => {
      try {
        const { data } = await this.http.get<T>(path, { params });
        return data;
      } catch (err) { throw this.wrapError(err); }
    });
  }

  private wrapError(err: unknown): PMSApiError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return new PMSApiError('hotelrunner', 'AUTH_FAILED', err.message, status);
      if (status === 404) return new PMSApiError('hotelrunner', 'NOT_FOUND', err.message, status);
      if (status === 429) return new PMSApiError('hotelrunner', 'RATE_LIMITED', 'Too many requests', status);
      if (status && status >= 500) return new PMSApiError('hotelrunner', 'SERVER_ERROR', err.message, status);
      if (!err.response) return new PMSApiError('hotelrunner', 'NETWORK_ERROR', err.message);
    }
    return new PMSApiError('hotelrunner', 'INVALID_RESPONSE', String(err));
  }

  private get pid(): string { return this.propertyId; }

  async fetchProperties(): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}`);
  }

  async fetchRoomTypes(): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/room_types`);
  }

  async fetchReservations(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/reservations`, {
      ...(options.startDate && { check_in_from: options.startDate }),
      ...(options.endDate && { check_in_to: options.endDate }),
      ...(options.limit && { per_page: options.limit }),
    });
  }

  async fetchRates(): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/rate_plans`);
  }

  async fetchAvailability(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/availability`, {
      ...(options.startDate && { start_date: options.startDate }),
      ...(options.endDate && { end_date: options.endDate }),
    });
  }

  async fetchGuests(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/guests`, {
      ...(options.limit && { per_page: options.limit }),
    });
  }

  async fetchFolios(options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/folios`, {
      ...(options.limit && { per_page: options.limit }),
    });
  }

  async fetchHousekeeping(_options: FetchOptions = {}): Promise<unknown> {
    return this.get(`/api/v1/properties/${this.pid}/housekeeping`);
  }
}
