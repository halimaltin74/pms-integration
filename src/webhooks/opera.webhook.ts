/**
 * Opera Cloud (OHIP) webhook handler.
 * Opera sends events via HTTP POST. The payload uses OPERA's envelope format.
 * No standard HMAC header — verify by IP allowlist or custom token in `x-oracle-webhook-token`.
 */

import { generateId } from '../utils';
import { safeCompare } from './signature';
import { WebhookHandler, WebhookHandlerResult, WebhookEvent, WebhookAction } from './types';
import { EntityType } from '../parser';

const EVENT_MAP: Record<string, { entity: EntityType; action: WebhookAction }> = {
  'RESERVATION.CREATED':      { entity: 'reservations', action: 'created' },
  'RESERVATION.UPDATED':      { entity: 'reservations', action: 'updated' },
  'RESERVATION.CANCELLED':    { entity: 'reservations', action: 'cancelled' },
  'RESERVATION.CHECKED_IN':   { entity: 'reservations', action: 'checked_in' },
  'RESERVATION.CHECKED_OUT':  { entity: 'reservations', action: 'checked_out' },
  'PROFILE.CREATED':          { entity: 'guests',        action: 'created' },
  'PROFILE.UPDATED':          { entity: 'guests',        action: 'updated' },
  'HOUSEKEEPING.STATUS_CHANGE':{ entity: 'housekeeping', action: 'status_changed' },
  'FOLIO.UPDATED':            { entity: 'folios',        action: 'updated' },
};

export function createOperaWebhookHandler(webhookToken?: string): WebhookHandler {
  return {
    verifySignature(_rawBody, headers) {
      if (!webhookToken) return true;
      const token = headers['x-oracle-webhook-token'] as string | undefined;
      if (!token) return false;
      return safeCompare(webhookToken, token);
    },

    parse(rawBody, _headers): WebhookHandlerResult {
      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf8')); } catch {
        return { event: null, ignored: true, ignoreReason: 'invalid JSON' };
      }

      const b = body as Record<string, unknown>;
      const eventType = String(b.eventType ?? b.type ?? '');
      const mapped = EVENT_MAP[eventType.toUpperCase()];
      if (!mapped) {
        return { event: null, ignored: true, ignoreReason: `unknown eventType: ${eventType}` };
      }

      const detail = (b.detail ?? b.data ?? {}) as Record<string, unknown>;
      const event: WebhookEvent = {
        id: generateId('opera'),
        pmsSource: 'opera',
        entityType: mapped.entity,
        action: mapped.action,
        entityId: String(detail.reservationId ?? detail.profileId ?? detail.roomId ?? detail.folioId ?? ''),
        propertyId: String(b.hotelId ?? detail.hotelId ?? ''),
        timestamp: String(b.timestamp ?? b.eventTime ?? new Date().toISOString()),
        payload: body,
      };
      return { event };
    },
  };
}
