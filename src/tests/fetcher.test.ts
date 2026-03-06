/**
 * fetcher.ts tests — axios is mocked so no real HTTP calls are made.
 */

import axios from 'axios';
import { fetchFromPMS, fetchFromStore } from '../fetcher';
import { InMemoryCredentialStore } from '../credentials/store';
import { AnyCredentials } from '../credentials/types';
import { tokenManager } from '../auth/token.manager';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    create: jest.fn(() => mockAxiosInstance),
    post: jest.fn(),
    isAxiosError: actual.isAxiosError,
  };
});

// Shared mock instance returned by axios.create()
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  request: jest.fn(),
  defaults: { headers: { common: {} } },
};

// ---------------------------------------------------------------------------
// Fixtures (minimal valid responses for each PMS)
// ---------------------------------------------------------------------------

const MEWS_RESERVATIONS_RAW = {
  reservations: [{
    Id: 'mews-res-001',
    Number: 'R001',
    StartUtc: '2024-06-01T12:00:00Z',
    EndUtc: '2024-06-03T12:00:00Z',
    AdultCount: 2,
    ChildCount: 0,
    State: 'Confirmed',
    Amount: { Currency: 'EUR', Value: 300 },
    CreatedUtc: '2024-05-01T09:00:00Z',
  }],
};

const CLOUDBEDS_ROOM_TYPES_RAW = {
  success: true,
  data: [{
    roomTypeID: '99',
    roomTypeName: 'Deluxe Double',
    roomTypeShortName: 'DD',
    maxGuests: 2,
    roomsCount: '5',
    roomTypeDescription: 'Sea view',
  }],
};

const OPERA_PROPERTIES_RAW = {
  hotelInfo: {
    hotelCode: 'OPERA001',
    hotelName: 'Opera Grand',
    address: { addressLine1: '1 Opera Sq', cityName: 'Istanbul', countryCode: 'TR' },
    contactNumbers: [{ phoneNumber: '+90 312 0000', phoneType: 'PHONE' }],
    timeZone: 'Europe/Istanbul',
    currency: 'EUR',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
};

const HR_GUESTS_RAW = {
  data: {
    guests: [{
      guest_id: 'hr-g-001',
      first_name: 'Ali',
      last_name: 'Veli',
      email: 'ali@veli.com',
      phone: '+90 530 0000',
      nationality: 'TR',
      gender: 'male',
    }],
  },
};

const ELECTRO_AVAILABILITY_RAW = {
  availability: [{
    roomTypeId: 'elec-001',
    propertyId: 'elec-prop-001',
    date: '2024-09-01',
    availableRooms: 4,
    totalRooms: 10,
    isOpen: true,
    minStay: 1,
  }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedToken(key: string) {
  tokenManager.seed(key, 'fake-token', Date.now() + 3600_000);
}

// ---------------------------------------------------------------------------
// Mews — POST-based client
// ---------------------------------------------------------------------------

describe('fetchFromPMS — Mews', () => {
  const creds: AnyCredentials = {
    pmsSource: 'mews',
    clientToken: 'ct-test',
    connectionToken: 'conn-test',
    environment: 'sandbox',
  };

  beforeEach(() => {
    mockAxiosInstance.post.mockResolvedValue({ data: MEWS_RESERVATIONS_RAW });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns parsed reservations', async () => {
    const results = await fetchFromPMS('mews', 'reservations', creds);
    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe('mews-res-001');
    expect(results[0].pmsSource).toBe('mews');
    expect(results[0].status).toBe('confirmed');
    expect(results[0].nights).toBe(2);
  });

  it('returns [] on network error', async () => {
    const netErr = new Error('connect ECONNREFUSED');
    Object.assign(netErr, { isAxiosError: true, response: undefined });
    mockAxiosInstance.post.mockRejectedValue(netErr);
    const results = await fetchFromPMS('mews', 'reservations', creds);
    expect(results).toEqual([]);
  });

  it('returns [] when pmsSource mismatch', async () => {
    const wrongCreds: AnyCredentials = { ...creds, pmsSource: 'cloudbeds' } as any;
    const results = await fetchFromPMS('mews', 'reservations', wrongCreds);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cloudbeds — GET-based with OAuth
// ---------------------------------------------------------------------------

describe('fetchFromPMS — Cloudbeds', () => {
  const creds: AnyCredentials = {
    pmsSource: 'cloudbeds',
    clientId: 'cb-client',
    clientSecret: 'cb-secret',
    refreshToken: 'cb-refresh',
    propertyId: 'cb-prop-001',
  };

  beforeEach(() => {
    seedToken('cloudbeds:cb-prop-001');
    mockAxiosInstance.get.mockResolvedValue({ data: CLOUDBEDS_ROOM_TYPES_RAW });
    (mockAxiosInstance.interceptors.request.use as jest.Mock).mockImplementation((fn: Function) => fn({ headers: {} }));
    (mockAxiosInstance.interceptors.response.use as jest.Mock).mockImplementation((ok: Function) => ok);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns parsed room types', async () => {
    const results = await fetchFromPMS('cloudbeds', 'roomTypes', creds);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Deluxe Double');
    expect(results[0].pmsSource).toBe('cloudbeds');
  });

  it('returns [] on 500 server error', async () => {
    const serverErr = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: 'error' },
    });
    mockAxiosInstance.get.mockRejectedValue(serverErr);
    const results = await fetchFromPMS('cloudbeds', 'roomTypes', creds);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Opera — GET-based with OAuth client_credentials
// ---------------------------------------------------------------------------

describe('fetchFromPMS — Opera', () => {
  const creds: AnyCredentials = {
    pmsSource: 'opera',
    hostname: 'hospitality.oracle.com',
    clientId: 'opera-client',
    clientSecret: 'opera-secret',
    enterpriseId: 'enterprise-001',
    hotelId: 'OPERA001',
  };

  beforeEach(() => {
    seedToken('opera:OPERA001');
    mockAxiosInstance.get.mockResolvedValue({ data: OPERA_PROPERTIES_RAW });
    (mockAxiosInstance.interceptors.request.use as jest.Mock).mockImplementation((fn: Function) => fn({ headers: {} }));
    (mockAxiosInstance.interceptors.response.use as jest.Mock).mockImplementation((ok: Function) => ok);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns parsed property', async () => {
    const results = await fetchFromPMS('opera', 'properties', creds);
    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe('OPERA001');
    expect(results[0].name).toBe('Opera Grand');
  });
});

// ---------------------------------------------------------------------------
// HotelRunner — API key client
// ---------------------------------------------------------------------------

describe('fetchFromPMS — HotelRunner', () => {
  const creds: AnyCredentials = {
    pmsSource: 'hotelrunner',
    apiKey: 'hr-api-key',
    propertyId: 'hr-prop-001',
  };

  beforeEach(() => {
    mockAxiosInstance.get.mockResolvedValue({ data: HR_GUESTS_RAW });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns parsed guests', async () => {
    const results = await fetchFromPMS('hotelrunner', 'guests', creds);
    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe('hr-g-001');
    expect(results[0].fullName).toBe('Ali Veli');
    expect(results[0].nationality).toBe('TR');
  });
});

// ---------------------------------------------------------------------------
// Electro — API key client
// ---------------------------------------------------------------------------

describe('fetchFromPMS — Electro', () => {
  const creds: AnyCredentials = {
    pmsSource: 'electro',
    apiKey: 'elec-api-key',
    baseUrl: 'https://api.electro-pms.com',
    propertyId: 'elec-prop-001',
  };

  beforeEach(() => {
    mockAxiosInstance.get.mockResolvedValue({ data: ELECTRO_AVAILABILITY_RAW });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns parsed availability', async () => {
    const results = await fetchFromPMS('electro', 'availability', creds);
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe('2024-09-01');
    expect(results[0].availableRooms).toBe(4);
    expect(results[0].pmsSource).toBe('electro');
  });
});

// ---------------------------------------------------------------------------
// fetchFromStore
// ---------------------------------------------------------------------------

describe('fetchFromStore', () => {
  it('returns [] when credentials not found in store', async () => {
    const store = new InMemoryCredentialStore();
    const results = await fetchFromStore('mews', 'reservations', 'unknown-property', store);
    expect(results).toEqual([]);
  });

  it('fetches using stored credentials', async () => {
    const store = new InMemoryCredentialStore();
    const creds: AnyCredentials & { propertyId: string } = {
      pmsSource: 'mews',
      clientToken: 'ct',
      connectionToken: 'conn',
      environment: 'sandbox',
      propertyId: 'prop-123',
    };
    await store.set(creds);
    mockAxiosInstance.post.mockResolvedValue({ data: MEWS_RESERVATIONS_RAW });

    const results = await fetchFromStore('mews', 'reservations', 'prop-123', store);
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TokenManager
// ---------------------------------------------------------------------------

describe('TokenManager', () => {
  beforeEach(() => {
    tokenManager.invalidate('test-key');
  });

  it('returns cached token without calling refreshFn again', async () => {
    const refreshFn = jest.fn().mockResolvedValue({ token: 'tok-1', expiresIn: 3600 });
    const t1 = await tokenManager.getToken('test-key', refreshFn);
    const t2 = await tokenManager.getToken('test-key', refreshFn);
    expect(t1).toBe('tok-1');
    expect(t2).toBe('tok-1');
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('refreshes when token is invalidated', async () => {
    const refreshFn = jest.fn()
      .mockResolvedValueOnce({ token: 'tok-1', expiresIn: 3600 })
      .mockResolvedValueOnce({ token: 'tok-2', expiresIn: 3600 });
    await tokenManager.getToken('test-key', refreshFn);
    tokenManager.invalidate('test-key');
    const t2 = await tokenManager.getToken('test-key', refreshFn);
    expect(t2).toBe('tok-2');
    expect(refreshFn).toHaveBeenCalledTimes(2);
  });

  it('does not call refreshFn twice concurrently', async () => {
    let resolve!: (v: { token: string; expiresIn: number }) => void;
    const refreshFn = jest.fn().mockReturnValue(new Promise(r => { resolve = r; }));
    const p1 = tokenManager.getToken('test-key', refreshFn);
    const p2 = tokenManager.getToken('test-key', refreshFn);
    resolve({ token: 'tok-concurrent', expiresIn: 3600 });
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('tok-concurrent');
    expect(t2).toBe('tok-concurrent');
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// InMemoryCredentialStore
// ---------------------------------------------------------------------------

describe('InMemoryCredentialStore', () => {
  it('set + get round-trips credentials', async () => {
    const store = new InMemoryCredentialStore();
    const creds: AnyCredentials & { propertyId: string } = {
      pmsSource: 'hotelrunner',
      apiKey: 'key-123',
      propertyId: 'hr-p-1',
    };
    await store.set(creds);
    const retrieved = await store.get('hotelrunner', 'hr-p-1');
    expect(retrieved).not.toBeNull();
    expect((retrieved as any).apiKey).toBe('key-123');
  });

  it('returns null for missing credentials', async () => {
    const store = new InMemoryCredentialStore();
    expect(await store.get('mews', 'nonexistent')).toBeNull();
  });

  it('delete removes credentials', async () => {
    const store = new InMemoryCredentialStore();
    const creds: AnyCredentials & { propertyId: string } = {
      pmsSource: 'electro',
      apiKey: 'key',
      baseUrl: 'https://example.com',
      propertyId: 'p-1',
    };
    await store.set(creds);
    await store.delete('electro', 'p-1');
    expect(await store.get('electro', 'p-1')).toBeNull();
  });

  it('update mutates stored value', async () => {
    const store = new InMemoryCredentialStore();
    const creds: AnyCredentials & { propertyId: string } = {
      pmsSource: 'cloudbeds',
      clientId: 'cid',
      clientSecret: 'csec',
      refreshToken: 'rt-old',
      propertyId: 'cb-p-1',
    };
    await store.set(creds);
    await store.update({ ...creds, refreshToken: 'rt-new' });
    const retrieved = await store.get('cloudbeds', 'cb-p-1');
    expect((retrieved as any).refreshToken).toBe('rt-new');
  });
});
