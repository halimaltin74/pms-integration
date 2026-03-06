import { PMSSource } from '../types/canonical';
import { AnyCredentials } from './types';

/**
 * CredentialStore interface.
 * Implement this with your preferred backend (DB, secrets manager, env vars).
 * The built-in InMemoryCredentialStore is suitable for development and testing.
 */
export interface CredentialStore {
  get(pmsSource: PMSSource, propertyId: string): Promise<AnyCredentials | null>;
  set(credentials: AnyCredentials & { propertyId: string }): Promise<void>;
  delete(pmsSource: PMSSource, propertyId: string): Promise<void>;
  /** Persist mutated credentials back (e.g. after token refresh) */
  update(credentials: AnyCredentials & { propertyId: string }): Promise<void>;
}

type StoreKey = `${PMSSource}:${string}`;

/**
 * Simple in-memory store.
 * Not suitable for production (data lost on restart, no encryption).
 */
export class InMemoryCredentialStore implements CredentialStore {
  private store = new Map<StoreKey, AnyCredentials>();

  async get(pmsSource: PMSSource, propertyId: string): Promise<AnyCredentials | null> {
    return this.store.get(`${pmsSource}:${propertyId}`) ?? null;
  }

  async set(credentials: AnyCredentials & { propertyId: string }): Promise<void> {
    this.store.set(`${credentials.pmsSource}:${credentials.propertyId}`, credentials);
  }

  async update(credentials: AnyCredentials & { propertyId: string }): Promise<void> {
    this.store.set(`${credentials.pmsSource}:${credentials.propertyId}`, credentials);
  }

  async delete(pmsSource: PMSSource, propertyId: string): Promise<void> {
    this.store.delete(`${pmsSource}:${propertyId}`);
  }

  /** List all stored property IDs for a given PMS */
  listPropertyIds(pmsSource: PMSSource): string[] {
    return [...this.store.keys()]
      .filter(k => k.startsWith(`${pmsSource}:`))
      .map(k => k.split(':')[1]);
  }
}

/** Module-level default store (can be replaced via setDefaultStore) */
let defaultStore: CredentialStore = new InMemoryCredentialStore();

export function getDefaultStore(): CredentialStore {
  return defaultStore;
}

export function setDefaultStore(store: CredentialStore): void {
  defaultStore = store;
}
