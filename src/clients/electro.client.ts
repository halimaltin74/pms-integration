/**
 * Electro PMS HTTP client.
 * Uses a static API key in the X-Api-Key header.
 * Update endpoint paths once the real spec is available.
 */

import axios, { AxiosInstance } from 'axios';
import { ElectroCredentials, FetchOptions } from '../credentials/types';
import { PMSApiError } from '../errors';

export class ElectroClient {
  private http: AxiosInstance;
  private propertyId: string;

  constructor(creds: ElectroCredentials) {
    this.propertyId = creds.propertyId ?? '';
    this.http = axios.create({
      baseURL: creds.baseUrl,
      timeout: 30_000,
      headers: {
        'X-Api-Key': creds.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const { data } = await this.http.get<T>(path, {
        params: { propertyId: this.propertyId, ...params },
      });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  private wrapError(err: unknown): PMSApiError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return new PMSApiError('electro', 'AUTH_FAILED', err.message, status);
      if (status === 404) return new PMSApiError('electro', 'NOT_FOUND', err.message, status);
      if (status === 429) return new PMSApiError('electro', 'RATE_LIMITED', 'Too many requests', status);
      if (status && status >= 500) return new PMSApiError('electro', 'SERVER_ERROR', err.message, status);
      if (!err.response) return new PMSApiError('electro', 'NETWORK_ERROR', err.message);
    }
    return new PMSApiError('electro', 'INVALID_RESPONSE', String(err));
  }

  async fetchProperties(): Promise<unknown> {
    return this.get('/api/v1/properties');
  }

  async fetchRoomTypes(): Promise<unknown> {
    return this.get('/api/v1/room-types');
  }

  async fetchReservations(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/api/v1/reservations', {
      ...(options.startDate && { checkInFrom: options.startDate }),
      ...(options.endDate && { checkInTo: options.endDate }),
      ...(options.limit && { limit: options.limit }),
    });
  }

  async fetchRates(): Promise<unknown> {
    return this.get('/api/v1/rates');
  }

  async fetchAvailability(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/api/v1/availability', {
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
    });
  }

  async fetchGuests(options: FetchOptions = {}): Promise<unknown> {
    return this.get('/api/v1/guests', {
      ...(options.limit && { limit: options.limit }),
    });
  }
}
