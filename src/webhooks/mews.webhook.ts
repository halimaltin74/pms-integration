/**
 * Mews webhook handler.
 * Mews signs payloads with a shared secret in the `X-Mews-Signature` header.
 * Event shape: { Events: [{ Type, Id, ... }] }
 */

import { generateId } from '../utils';
import { verifySha256Header } from './signature';
import { WebhookHandler, WebhookHandlerResult, WebhookEvent, WebhookAction } from './types';
import { EntityType } from '../parser';

const TYPE_MAP: Record<string, { entity: EntityType; action: WebhookAction }> = {
  ReservationCreated:   { entity: 'reservations', action: 'created' },
  ReservationUpdated:   { entity: 'reservations', action: 'updated' },
  ReservationCancelled: { entity: 'reservations', action: 'cancelled' },
  ReservationCheckedIn: { entity: 'reservations', action: 'checked_in' },
  ReservationCheckedOut:{ entity: 'reservations', action: 'checked_out' },
  GuestCreated:         { entity: 'guests',        action: 'created' },
  GuestUpdated:         { entity: 'guests',        action: 'updated' },
  RoomStatusUpdated:    { entity: 'housekeeping',  action: 'status_changed' },
};

export function createMewsWebhookHandler(secret?: string): WebhookHandler {
  return {
    verifySignature(rawBody, headers) {
      if (!secret) return true; // skip verification if no secret configured
      const sig = headers['x-mews-signature'] as string | undefined;
      return verifySha256Header(secret, rawBody, sig, 'sha256=');
    },

    parse(rawBody, _headers): WebhookHandlerResult {
      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf8')); } catch {
        return { event: null, ignored: true, ignoreReason: 'invalid JSON' };
      }

      const events = (body as any)?.Events;
      if (!Array.isArray(events) || events.length === 0) {
        return { event: null, ignored: true, ignoreReason: 'no Events array' };
      }

      // Use first event (callers can loop if needed)
      const raw = events[0] as Record<string, unknown>;
      const type = String(raw.Type ?? '');
      const mapped = TYPE_MAP[type];
      if (!mapped) {
        return { event: null, ignored: true, ignoreReason: `unknown event type: ${type}` };
      }

      const event: WebhookEvent = {
        id: generateId('mews'),
        pmsSource: 'mews',
        entityType: mapped.entity,
        action: mapped.action,
        entityId: String(raw.Id ?? raw.ReservationId ?? ''),
        propertyId: String(raw.HotelId ?? raw.PropertyId ?? ''),
        timestamp: String(raw.CreatedUtc ?? new Date().toISOString()),
        payload: body,
      };
      return { event };
    },
  };
}
