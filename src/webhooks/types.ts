import { PMSSource } from '../types/canonical';
import { EntityType } from '../parser';

// ---------------------------------------------------------------------------
// Canonical webhook event
// ---------------------------------------------------------------------------

export type WebhookAction = 'created' | 'updated' | 'deleted' | 'cancelled' | 'checked_in' | 'checked_out' | 'status_changed';

export interface WebhookEvent {
  id: string;
  pmsSource: PMSSource;
  entityType: EntityType;
  action: WebhookAction;
  entityId: string;
  propertyId?: string;
  timestamp: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Handler interface
// ---------------------------------------------------------------------------

export interface WebhookHandlerResult {
  event: WebhookEvent | null;
  /** If true, the raw payload was not recognised (skip silently) */
  ignored?: boolean;
  /** Human-readable reason for ignoring */
  ignoreReason?: string;
}

export type WebhookHandler = {
  /** Return true when the handler can verify the signature (may be a no-op for some PMS) */
  verifySignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  /** Parse the raw body into a canonical WebhookEvent. Return null if unrecognised. */
  parse(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookHandlerResult;
};
