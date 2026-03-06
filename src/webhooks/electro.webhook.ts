/**
 * Electro PMS webhook handler.
 * Signs with HMAC-SHA256 in `X-Electro-Signature`.
 * Event shape: { eventType, propertyId, entityId, data: { ... } }
 */

import { generateId } from '../utils';
import { verifySha256Header } from './signature';
import { WebhookHandler, WebhookHandlerResult, WebhookEvent, WebhookAction } from './types';
import { EntityType } from '../parser';

const EVENT_MAP: Record<string, { entity: EntityType; action: WebhookAction }> = {
  'reservation.created':   { entity: 'reservations', action: 'created' },
  'reservation.updated':   { entity: 'reservations', action: 'updated' },
  'reservation.cancelled': { entity: 'reservations', action: 'cancelled' },
  'reservation.checkedIn': { entity: 'reservations', action: 'checked_in' },
  'reservation.checkedOut':{ entity: 'reservations', action: 'checked_out' },
  'guest.created':         { entity: 'guests',        action: 'created' },
  'guest.updated':         { entity: 'guests',        action: 'updated' },
  'housekeeping.updated':  { entity: 'housekeeping',  action: 'status_changed' },
  'folio.updated':         { entity: 'folios',        action: 'updated' },
};

export function createElectroWebhookHandler(secret?: string): WebhookHandler {
  return {
    verifySignature(rawBody, headers) {
      if (!secret) return true;
      const sig = headers['x-electro-signature'] as string | undefined;
      return verifySha256Header(secret, rawBody, sig, 'sha256=');
    },

    parse(rawBody, _headers): WebhookHandlerResult {
      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf8')); } catch {
        return { event: null, ignored: true, ignoreReason: 'invalid JSON' };
      }

      const b = body as Record<string, unknown>;
      const eventType = String(b.eventType ?? '');
      const mapped = EVENT_MAP[eventType];
      if (!mapped) {
        return { event: null, ignored: true, ignoreReason: `unknown eventType: ${eventType}` };
      }

      const event: WebhookEvent = {
        id: generateId('electro'),
        pmsSource: 'electro',
        entityType: mapped.entity,
        action: mapped.action,
        entityId: String(b.entityId ?? ''),
        propertyId: String(b.propertyId ?? ''),
        timestamp: String(b.timestamp ?? new Date().toISOString()),
        payload: body,
      };
      return { event };
    },
  };
}
