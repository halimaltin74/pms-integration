/**
 * Cloudbeds webhook handler.
 * Cloudbeds signs with HMAC-SHA256 in `X-Cloudbeds-Webhook-Signature`.
 * Event shape: { action, hotelID, reservationID?, guestID?, data: {...} }
 */

import { generateId } from '../utils';
import { verifySha256Header } from './signature';
import { WebhookHandler, WebhookHandlerResult, WebhookEvent, WebhookAction } from './types';
import { EntityType } from '../parser';

const ACTION_MAP: Record<string, { entity: EntityType; action: WebhookAction }> = {
  createReservation:  { entity: 'reservations', action: 'created' },
  modifyReservation:  { entity: 'reservations', action: 'updated' },
  cancelReservation:  { entity: 'reservations', action: 'cancelled' },
  checkIn:            { entity: 'reservations', action: 'checked_in' },
  checkOut:           { entity: 'reservations', action: 'checked_out' },
  createGuest:        { entity: 'guests',        action: 'created' },
  updateGuest:        { entity: 'guests',        action: 'updated' },
  roomStatusChanged:  { entity: 'housekeeping',  action: 'status_changed' },
};

export function createCloudbedsWebhookHandler(secret?: string): WebhookHandler {
  return {
    verifySignature(rawBody, headers) {
      if (!secret) return true;
      const sig = headers['x-cloudbeds-webhook-signature'] as string | undefined;
      return verifySha256Header(secret, rawBody, sig, 'sha256=');
    },

    parse(rawBody, _headers): WebhookHandlerResult {
      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf8')); } catch {
        return { event: null, ignored: true, ignoreReason: 'invalid JSON' };
      }

      const b = body as Record<string, unknown>;
      const action = String(b.action ?? '');
      const mapped = ACTION_MAP[action];
      if (!mapped) {
        return { event: null, ignored: true, ignoreReason: `unknown action: ${action}` };
      }

      const entityId = String(b.reservationID ?? b.guestID ?? b.roomID ?? '');
      const event: WebhookEvent = {
        id: generateId('cloudbeds'),
        pmsSource: 'cloudbeds',
        entityType: mapped.entity,
        action: mapped.action,
        entityId,
        propertyId: String(b.hotelID ?? b.propertyID ?? ''),
        timestamp: String(b.timestamp ?? new Date().toISOString()),
        payload: body,
      };
      return { event };
    },
  };
}
