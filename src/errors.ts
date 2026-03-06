import { PMSSource } from './types/canonical';

export type PmsErrorCode =
  | 'AUTH_FAILED'
  | 'TOKEN_REFRESH_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export class PMSApiError extends Error {
  constructor(
    public readonly pmsSource: PMSSource,
    public readonly code: PmsErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly raw?: unknown,
  ) {
    super(`[${pmsSource}] ${code}: ${message}`);
    this.name = 'PMSApiError';
  }
}
