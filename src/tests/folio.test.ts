import { parseFromPMS } from '../parser';
import { CanonicalFolio } from '../types/folio.canonical';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertFolioShape(f: CanonicalFolio) {
  expect(typeof f.id).toBe('string');
  expect(f.id.length).toBeGreaterThan(0);
  expect(typeof f.externalId).toBe('string');
  expect(['open', 'closed', 'void']).toContain(f.status);
  expect(typeof f.totalCharges).toBe('number');
  expect(typeof f.totalPayments).toBe('number');
  expect(typeof f.totalTax).toBe('number');
  expect(typeof f.outstandingBalance).toBe('number');
  expect(Array.isArray(f.items)).toBe(true);
  expect(typeof f.confidence).toBe('number');
  expect(f.confidence).toBeGreaterThanOrEqual(0);
  expect(f.confidence).toBeLessThanOrEqual(1);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mewsFolioResponse = {
  bills: [
    {
      Id: 'folio-001',
      ReservationId: 'res-111',
      ServiceId: 'prop-01',
      CustomerId: 'guest-01',
      State: 'Open',
      Currency: 'EUR',
      Items: [
        { Id: 'item-1', Type: 'ServiceRevenue', Name: 'Room charge', Amount: { Value: 150, Currency: 'EUR' }, TaxAmount: { Value: 30 }, ConsumedUtc: '2024-06-01T00:00:00Z' },
        { Id: 'item-2', Type: 'Payment', Name: 'Card payment', Amount: { Value: -180, Currency: 'EUR' }, TaxAmount: { Value: 0 }, ConsumedUtc: '2024-06-02T00:00:00Z' },
      ],
      CreatedUtc: '2024-05-31T14:00:00Z',
    },
  ],
};

const cloudbedsFolioResponse = {
  success: true,
  data: [
    {
      folioID: 'f-200',
      reservationID: 'r-300',
      propertyID: 'p-1',
      guestID: 'g-50',
      status: 'open',
      currency: 'USD',
      items: [
        { itemID: 'i-1', itemType: 'room', itemDescription: 'Room', itemAmount: 200, itemTax: 20, itemDate: '2024-06-01' },
      ],
      createdDate: '2024-06-01T12:00:00Z',
      closedDate: '',
    },
  ],
};

const operaFolioResponse = {
  folioDetails: [
    {
      folioId: 'of-99',
      reservationId: 'or-10',
      hotelId: 'H1',
      profileId: 'gp-1',
      folioStatus: 'OPEN',
      currency: 'GBP',
      transactionList: [
        {
          transactionCode: 'TC1',
          transactionType: 'ROOM',
          transactionDescription: 'Room',
          amount: { amount: 120, currencyCode: 'GBP' },
          taxAmount: { amount: 24 },
          transactionDate: '2024-06-01',
        },
      ],
      openDate: '2024-06-01',
      closeDate: '',
    },
  ],
};

const hotelrunnerFolioResponse = {
  data: {
    folios: [
      {
        folio_id: 'hrf-1',
        reservation_id: 'hrr-5',
        property_id: 'hrp-1',
        guest_id: 'hrg-2',
        status: 'open',
        currency: 'TRY',
        items: [
          { item_id: 'hri-1', item_type: 'room', description: 'Room', amount: 500, tax_amount: 50, date: '2024-06-01' },
        ],
        created_at: '2024-06-01',
        closed_at: '',
      },
    ],
  },
};

const electroFolioResponse = {
  folios: [
    {
      id: 'ef-1',
      reservationId: 'er-1',
      propertyId: 'ep-1',
      guestId: 'eg-1',
      status: 'open',
      currency: 'EUR',
      items: [
        { id: 'ei-1', type: 'room_charge', description: 'Room', amount: 100, taxAmount: 10, date: '2024-06-01' },
      ],
      createdAt: '2024-06-01',
      closedAt: '',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Folio adapter — Mews', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('mews', 'folios', mewsFolioResponse);
    expect(result.length).toBe(1);
    assertFolioShape(result[0]);
    expect(result[0].pmsSource).toBe('mews');
    expect(result[0].externalId).toBe('folio-001');
    expect(result[0].status).toBe('open');
    expect(result[0].currency).toBe('EUR');
    expect(result[0].totalCharges).toBeGreaterThan(0);
  });

  it('returns empty array for invalid input', () => {
    expect(parseFromPMS('mews', 'folios', null)).toEqual([]);
    expect(parseFromPMS('mews', 'folios', 'bad')).toEqual([]);
  });
});

describe('Folio adapter — Cloudbeds', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('cloudbeds', 'folios', cloudbedsFolioResponse);
    expect(result.length).toBe(1);
    assertFolioShape(result[0]);
    expect(result[0].pmsSource).toBe('cloudbeds');
    expect(result[0].currency).toBe('USD');
  });
});

describe('Folio adapter — Opera', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('opera', 'folios', operaFolioResponse);
    expect(result.length).toBe(1);
    assertFolioShape(result[0]);
    expect(result[0].pmsSource).toBe('opera');
    expect(result[0].currency).toBe('GBP');
  });
});

describe('Folio adapter — HotelRunner', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('hotelrunner', 'folios', hotelrunnerFolioResponse);
    expect(result.length).toBe(1);
    assertFolioShape(result[0]);
    expect(result[0].pmsSource).toBe('hotelrunner');
    expect(result[0].currency).toBe('TRY');
  });
});

describe('Folio adapter — Electro', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('electro', 'folios', electroFolioResponse);
    expect(result.length).toBe(1);
    assertFolioShape(result[0]);
    expect(result[0].pmsSource).toBe('electro');
    expect(result[0].currency).toBe('EUR');
  });

  it('parses flat array', () => {
    const result = parseFromPMS('electro', 'folios', electroFolioResponse.folios);
    expect(result.length).toBe(1);
  });
});
