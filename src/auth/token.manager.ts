/**
 * Shared OAuth token manager.
 * Handles caching + concurrent refresh protection for any PMS that uses
 * short-lived Bearer tokens (Cloudbeds, Opera Cloud).
 */

interface CachedToken {
  token: string;
  /** Unix ms timestamp */
  expiresAt: number;
}

/** Refresh early by this many ms to avoid clock skew / last-second failures */
const REFRESH_BUFFER_MS = 30_000;

export class TokenManager {
  private cache = new Map<string, CachedToken>();
  /** In-flight refresh promises — prevents duplicate requests */
  private refreshing = new Map<string, Promise<string>>();

  /**
   * Returns a valid token for `key`, refreshing if necessary.
   * @param key       Unique cache key (e.g. "cloudbeds:propertyId")
   * @param refreshFn Called when the cached token is missing or near expiry.
   *                  Must return { token, expiresIn } where expiresIn is seconds.
   */
  async getToken(
    key: string,
    refreshFn: () => Promise<{ token: string; expiresIn: number }>,
  ): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt - REFRESH_BUFFER_MS) {
      return cached.token;
    }

    // Return existing in-flight refresh if one is already running
    const inFlight = this.refreshing.get(key);
    if (inFlight) return inFlight;

    const promise = refreshFn()
      .then(({ token, expiresIn }) => {
        this.cache.set(key, { token, expiresAt: Date.now() + expiresIn * 1_000 });
        this.refreshing.delete(key);
        return token;
      })
      .catch((err) => {
        this.refreshing.delete(key);
        throw err;
      });

    this.refreshing.set(key, promise);
    return promise;
  }

  /** Manually invalidate a cached token (e.g. after a 401 response) */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Seed a token directly (e.g. after initial OAuth exchange) */
  seed(key: string, token: string, expiresAt: number): void {
    this.cache.set(key, { token, expiresAt });
  }
}

/** Singleton — shared across all auth modules */
export const tokenManager = new TokenManager();
