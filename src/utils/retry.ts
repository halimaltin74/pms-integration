import axios from 'axios';
import { PMSApiError } from '../errors';

export interface RetryOptions {
  /** Max total attempts (including first try). Default: 4 */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default: 500 */
  initialDelayMs?: number;
  /** Backoff multiplier. Default: 2 (doubles each retry) */
  backoffFactor?: number;
  /** Max delay cap in ms. Default: 15 000 */
  maxDelayMs?: number;
}

const DEFAULT_OPTS: Required<RetryOptions> = {
  maxAttempts: 4,
  initialDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 15_000,
};

function isRetryable(err: unknown): boolean {
  if (err instanceof PMSApiError) {
    return err.code === 'RATE_LIMITED' || err.code === 'SERVER_ERROR' || err.code === 'NETWORK_ERROR';
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    return !status || status === 429 || status >= 500;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes `fn` with exponential backoff on retryable errors.
 * Retryable: RATE_LIMITED, SERVER_ERROR, NETWORK_ERROR, no response.
 * Non-retryable: AUTH_FAILED, NOT_FOUND, INVALID_RESPONSE — fail immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { maxAttempts, initialDelayMs, backoffFactor, maxDelayMs } = { ...DEFAULT_OPTS, ...opts };
  let lastErr: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;

      // Honour Retry-After header when rate-limited
      let waitMs = delayMs;
      if (axios.isAxiosError(err) && err.response?.headers?.['retry-after']) {
        const retryAfter = parseInt(err.response.headers['retry-after'], 10);
        if (!isNaN(retryAfter)) waitMs = retryAfter * 1_000;
      }

      await delay(Math.min(waitMs, maxDelayMs));
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }

  throw lastErr;
}
