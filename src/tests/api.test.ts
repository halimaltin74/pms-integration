import request from 'supertest';
import { createApp } from '../api/server';
import { getDefaultStore, setDefaultStore, InMemoryCredentialStore } from '../credentials/store';
import { MewsCredentials } from '../credentials/types';

// Reset to a fresh store before each test
beforeEach(() => {
  setDefaultStore(new InMemoryCredentialStore());
});

const app = createApp();

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with ok:true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Credential routes
// ---------------------------------------------------------------------------

describe('POST /credentials/:pms', () => {
  it('stores credentials and returns 201', async () => {
    const res = await request(app)
      .post('/credentials/mews')
      .send({ propertyId: 'prop-1', clientToken: 'ct', connectionToken: 'ct2', environment: 'sandbox' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.pmsSource).toBe('mews');
  });

  it('returns 400 for missing propertyId', async () => {
    const res = await request(app)
      .post('/credentials/mews')
      .send({ clientToken: 'ct' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown PMS', async () => {
    const res = await request(app)
      .post('/credentials/unknown_pms')
      .send({ propertyId: 'p1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /credentials/:pms/:propertyId', () => {
  it('returns 404 when not found', async () => {
    const res = await request(app).get('/credentials/mews/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 200 after storing credentials', async () => {
    await request(app)
      .post('/credentials/mews')
      .send({ propertyId: 'prop-1', clientToken: 'ct', connectionToken: 'ct2', environment: 'sandbox' });

    const res = await request(app).get('/credentials/mews/prop-1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('DELETE /credentials/:pms/:propertyId', () => {
  it('returns 200 after deletion', async () => {
    await request(app)
      .post('/credentials/mews')
      .send({ propertyId: 'prop-del', clientToken: 'ct', connectionToken: 'ct2', environment: 'sandbox' });

    const del = await request(app).delete('/credentials/mews/prop-del');
    expect(del.status).toBe(200);

    const get = await request(app).get('/credentials/mews/prop-del');
    expect(get.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Entity routes — validation only (no real HTTP calls)
// ---------------------------------------------------------------------------

describe('GET /entities/:pms/:entity', () => {
  it('returns 400 for missing propertyId', async () => {
    const res = await request(app).get('/entities/mews/reservations');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/propertyId/);
  });

  it('returns 400 for unknown PMS', async () => {
    const res = await request(app).get('/entities/unknown/reservations?propertyId=p1');
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown entity type', async () => {
    const res = await request(app).get('/entities/mews/unknownEntity?propertyId=p1');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Webhook routes
// ---------------------------------------------------------------------------

describe('POST /webhooks/:pms', () => {
  it('returns 400 for unknown PMS', async () => {
    const res = await request(app)
      .post('/webhooks/unknown_pms')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid Mews webhook (open mode)', async () => {
    const body = JSON.stringify({
      Events: [{ Type: 'ReservationCreated', Id: 'r1', HotelId: 'p1', CreatedUtc: '2024-06-01T10:00:00Z' }],
    });
    const res = await request(app)
      .post('/webhooks/mews')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(body));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 200 with ignored:true for unknown event type', async () => {
    const body = JSON.stringify({ Events: [{ Type: 'UnknownEvent', Id: 'x' }] });
    const res = await request(app)
      .post('/webhooks/mews')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(body));
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
  });

  it('parses Electro webhook', async () => {
    const body = JSON.stringify({
      eventType: 'reservation.created',
      propertyId: 'ep-1',
      entityId: 'er-1',
      timestamp: '2024-06-01T10:00:00Z',
    });
    const res = await request(app)
      .post('/webhooks/electro')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(body));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
