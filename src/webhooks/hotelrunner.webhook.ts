/**
 * HotelRunner webhook handler.
 * Signs with HMAC-SHA256 in `X-HotelRunner-Signature`.
 * Event shape: { event, property_id, data: { ... } }
 */

import { generateId } from '../utils';
import { verifySha256Header } from './signature';
import { WebhookHandler, WebhookHandlerResult, WebhookEvent, WebhookAction } from './types';
import { EntityType } from '../parser';

const EVENT_MAP: Record<string, { entity: EntityType; action: WebhookAction }> = {
  'reservation.created':   { entity: 'reservations', action: 'created' },
  'reservation.updated':   { entity: 'reservations', action: 'updated' },
  'reservation.cancelled': { entity: 'reservations', action: 'cancelled' },
  'reservation.checked_in':  { entity: 'reservations', action: 'checked_in' },
  'reservation.checked_out': { entity: 'reservations', action: 'checked_out' },
  'guest.created':         { entity: 'guests',        action: 'created' },
  'guest.updated':         { entity: 'guests',        action: 'updated' },
  'room.status_changed':   { entity: 'housekeeping',  action: 'status_changed' },
  'folio.updated':         { entity: 'folios',        action: 'updated' },
};

export function createHotelRunnerWebhookHandler(secret?: string): WebhookHandler {
  return {
    verifySignature(rawBody, headers) {
      if (!secret) return true;
      const sig = headers['x-hotelrunner-signature'] as string | undefined;
      return verifySha256Header(secret, rawBody, sig, 'sha256=');
    },

    parse(rawBody, _headers): WebhookHandlerResult {
      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf8')); } catch {
        return { event: null, ignored: true, ignoreReason: 'invalid JSON' };
      }

      const b = body as Record<string, unknown>;
      const eventName = String(b.event ?? '');
      const mapped = EVENT_MAP[eventName];
      if (!mapped) {
        return { event: null, ignored: true, ignoreReason: `unknown event: ${eventName}` };
      }

      const data = (b.data ?? {}) as Record<string, unknown>;
      const event: WebhookEvent = {
        id: generateId('hotelrunner'),
        pmsSource: 'hotelrunner',
        entityType: mapped.entity,
        action: mapped.action,
        entityId: String(data.reservation_id ?? data.guest_id ?? data.room_id ?? data.folio_id ?? ''),
        propertyId: String(b.property_id ?? data.property_id ?? ''),
        timestamp: String(b.timestamp ?? b.occurred_at ?? new Date().toISOString()),
        payload: body,
      };
      return { event };
    },
  };
}
