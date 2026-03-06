import { createWebhookRouter } from '../webhooks/router';
import { hmacSha256Hex, verifySha256Header, safeCompare } from '../webhooks/signature';

// ---------------------------------------------------------------------------
// Signature utilities
// ---------------------------------------------------------------------------

describe('signature utilities', () => {
  const SECRET = 'test-secret-key';
  const PAYLOAD = Buffer.from('{"event":"test"}');

  it('hmacSha256Hex produces consistent hex', () => {
    const h1 = hmacSha256Hex(SECRET, PAYLOAD);
    const h2 = hmacSha256Hex(SECRET, PAYLOAD);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('safeCompare works correctly', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'def')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });

  it('verifySha256Header accepts valid signature', () => {
    const sig = `sha256=${hmacSha256Hex(SECRET, PAYLOAD)}`;
    expect(verifySha256Header(SECRET, PAYLOAD, sig)).toBe(true);
  });

  it('verifySha256Header rejects tampered payload', () => {
    const sig = `sha256=${hmacSha256Hex(SECRET, PAYLOAD)}`;
    const tampered = Buffer.from('{"event":"tampered"}');
    expect(verifySha256Header(SECRET, tampered, sig)).toBe(false);
  });

  it('verifySha256Header rejects missing header', () => {
    expect(verifySha256Header(SECRET, PAYLOAD, undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Webhook router — no-secret (open) mode
// ---------------------------------------------------------------------------

const router = createWebhookRouter(); // no secrets → skip sig verification

describe('WebhookRouter — Mews', () => {
  const body = Buffer.from(JSON.stringify({
    Events: [{ Type: 'ReservationCreated', Id: 'res-1', HotelId: 'prop-1', CreatedUtc: '2024-06-01T10:00:00Z' }],
  }));

  it('parses reservation.created', () => {
    const { event, signatureValid } = router.handle('mews', body, {});
    expect(signatureValid).toBe(true);
    expect(event).not.toBeNull();
    expect(event!.pmsSource).toBe('mews');
    expect(event!.entityType).toBe('reservations');
    expect(event!.action).toBe('created');
    expect(event!.entityId).toBe('res-1');
  });

  it('ignores unknown event type', () => {
    const b = Buffer.from(JSON.stringify({ Events: [{ Type: 'UnknownEvent', Id: 'x' }] }));
    const { ignored } = router.handle('mews', b, {});
    expect(ignored).toBe(true);
  });

  it('ignores invalid JSON', () => {
    const { ignored } = router.handle('mews', Buffer.from('not json'), {});
    expect(ignored).toBe(true);
  });
});

describe('WebhookRouter — Cloudbeds', () => {
  it('parses reservation created', () => {
    const body = Buffer.from(JSON.stringify({
      action: 'createReservation',
      hotelID: 'p1',
      reservationID: 'r1',
      timestamp: '2024-06-01T10:00:00Z',
    }));
    const { event } = router.handle('cloudbeds', body, {});
    expect(event!.entityType).toBe('reservations');
    expect(event!.action).toBe('created');
    expect(event!.entityId).toBe('r1');
  });

  it('parses room status change', () => {
    const body = Buffer.from(JSON.stringify({
      action: 'roomStatusChanged',
      hotelID: 'p1',
      roomID: 'room-5',
    }));
    const { event } = router.handle('cloudbeds', body, {});
    expect(event!.entityType).toBe('housekeeping');
    expect(event!.action).toBe('status_changed');
  });
});

describe('WebhookRouter — Opera', () => {
  it('parses reservation created', () => {
    const body = Buffer.from(JSON.stringify({
      eventType: 'RESERVATION.CREATED',
      hotelId: 'H1',
      detail: { reservationId: 'or-1' },
      timestamp: '2024-06-01T10:00:00Z',
    }));
    const { event } = router.handle('opera', body, {});
    expect(event!.entityType).toBe('reservations');
    expect(event!.action).toBe('created');
    expect(event!.entityId).toBe('or-1');
  });

  it('parses housekeeping status change', () => {
    const body = Buffer.from(JSON.stringify({
      eventType: 'HOUSEKEEPING.STATUS_CHANGE',
      hotelId: 'H1',
      detail: { roomId: 'R101' },
    }));
    const { event } = router.handle('opera', body, {});
    expect(event!.entityType).toBe('housekeeping');
  });
});

describe('WebhookRouter — HotelRunner', () => {
  it('parses reservation cancelled', () => {
    const body = Buffer.from(JSON.stringify({
      event: 'reservation.cancelled',
      property_id: 'p1',
      data: { reservation_id: 'hr-r1' },
      timestamp: '2024-06-01T10:00:00Z',
    }));
    const { event } = router.handle('hotelrunner', body, {});
    expect(event!.action).toBe('cancelled');
    expect(event!.entityId).toBe('hr-r1');
  });
});

describe('WebhookRouter — Electro', () => {
  it('parses folio updated', () => {
    const body = Buffer.from(JSON.stringify({
      eventType: 'folio.updated',
      propertyId: 'ep-1',
      entityId: 'ef-1',
      timestamp: '2024-06-01T10:00:00Z',
    }));
    const { event } = router.handle('electro', body, {});
    expect(event!.entityType).toBe('folios');
    expect(event!.action).toBe('updated');
    expect(event!.entityId).toBe('ef-1');
  });
});

// ---------------------------------------------------------------------------
// Signature verification mode
// ---------------------------------------------------------------------------

describe('WebhookRouter — signature verification', () => {
  const SECRET = 'my-secret';
  const secureRouter = createWebhookRouter({ mews: { secret: SECRET } });

  it('rejects request with wrong signature', () => {
    const body = Buffer.from(JSON.stringify({ Events: [{ Type: 'ReservationCreated', Id: 'x' }] }));
    const headers = { 'x-mews-signature': 'sha256=badhash' };
    const { signatureValid, ignored } = secureRouter.handle('mews', body, headers);
    expect(signatureValid).toBe(false);
    expect(ignored).toBe(true);
  });

  it('accepts request with correct signature', () => {
    const body = Buffer.from(JSON.stringify({ Events: [{ Type: 'ReservationCreated', Id: 'r1', HotelId: 'p1' }] }));
    const hash = hmacSha256Hex(SECRET, body);
    const headers = { 'x-mews-signature': `sha256=${hash}` };
    const { signatureValid, event } = secureRouter.handle('mews', body, headers);
    expect(signatureValid).toBe(true);
    expect(event).not.toBeNull();
  });
});

describe('WebhookRouter — unknown PMS', () => {
  it('returns ignored with signatureValid=false', () => {
    const { ignored, signatureValid } = router.handle('unknown' as any, Buffer.from('{}'), {});
    expect(ignored).toBe(true);
    expect(signatureValid).toBe(false);
  });
});
