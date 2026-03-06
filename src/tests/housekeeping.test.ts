import { parseFromPMS } from '../parser';
import { CanonicalHousekeeping } from '../types/housekeeping.canonical';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertHKShape(h: CanonicalHousekeeping) {
  expect(typeof h.id).toBe('string');
  expect(h.id.length).toBeGreaterThan(0);
  expect(typeof h.externalId).toBe('string');
  expect(['clean', 'dirty', 'inspected', 'out_of_service', 'out_of_order']).toContain(h.housekeepingStatus);
  expect(['occupied', 'vacant', 'due_out', 'due_in']).toContain(h.occupancyStatus);
  expect(typeof h.roomNumber).toBe('string');
  expect(typeof h.confidence).toBe('number');
  expect(h.confidence).toBeGreaterThanOrEqual(0);
  expect(h.confidence).toBeLessThanOrEqual(1);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mewsHKResponse = {
  spaces: [
    {
      Id: 'room-01',
      Number: '101',
      Floor: '1',
      SpaceTypeId: 'rt-1',
      ServiceId: 'prop-1',
      HousekeepingStatus: 'Clean',
      OccupancyState: 'Vacant',
      AssigneeName: 'staff-1',
      Notes: 'Check window',
      LastCleanedUtc: '2024-06-01T08:00:00Z',
      UpdatedUtc: '2024-06-01T09:00:00Z',
    },
  ],
};

const cloudbedsHKResponse = {
  success: true,
  data: [
    {
      roomID: 'cbr-1',
      roomNumber: '201',
      roomFloor: '2',
      roomTypeID: 'cbrt-1',
      propertyID: 'cbp-1',
      housekeepingStatus: 'dirty',
      occupancyStatus: 'occupied',
      assignedHousekeeper: 'John',
      notes: '',
      lastCleaned: '2024-06-01',
      updatedDate: '2024-06-01',
    },
  ],
};

const operaHKResponse = {
  rooms: {
    room: [
      {
        roomId: 'or-101',
        roomNumber: '301',
        floor: '3',
        roomType: 'DLX',
        hotelId: 'H1',
        housekeepingStatus: 'CLEAN',
        frontDeskStatus: 'VACANT',
        attendant: 'Maria',
        remarks: '',
        lastCleanDate: '2024-06-01',
        lastModifiedDateTime: '2024-06-01T10:00:00Z',
      },
    ],
  },
};

const hotelrunnerHKResponse = {
  data: {
    rooms: [
      {
        room_id: 'hrr-1',
        room_number: '401',
        floor: '4',
        room_type_id: 'hrrt-1',
        property_id: 'hrp-1',
        housekeeping_status: 'clean',
        occupancy_status: 'vacant',
        assigned_to: 'Anna',
        notes: '',
        last_cleaned_at: '2024-06-01',
        updated_at: '2024-06-01',
      },
    ],
  },
};

const electroHKResponse = {
  rooms: [
    {
      id: 'er-1',
      roomNumber: '501',
      floor: '5',
      roomTypeId: 'ert-1',
      propertyId: 'ep-1',
      housekeepingStatus: 'inspected',
      occupancyStatus: 'due_out',
      assignedTo: 'Tom',
      notes: '',
      lastCleanedAt: '2024-06-01',
      updatedAt: '2024-06-01',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Housekeeping adapter — Mews', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('mews', 'housekeeping', mewsHKResponse);
    expect(result.length).toBe(1);
    assertHKShape(result[0]);
    expect(result[0].pmsSource).toBe('mews');
    expect(result[0].housekeepingStatus).toBe('clean');
    expect(result[0].occupancyStatus).toBe('vacant');
    expect(result[0].roomNumber).toBe('101');
  });

  it('returns empty array for invalid input', () => {
    expect(parseFromPMS('mews', 'housekeeping', null)).toEqual([]);
    expect(parseFromPMS('mews', 'housekeeping', 'bad')).toEqual([]);
  });

  it('defaults unknown status to dirty/vacant', () => {
    const raw = { spaces: [{ Id: 'x', HousekeepingStatus: 'UNKNOWN_STATUS', OccupancyState: 'UNKNOWN' }] };
    const result = parseFromPMS('mews', 'housekeeping', raw);
    expect(result[0].housekeepingStatus).toBe('dirty');
    expect(result[0].occupancyStatus).toBe('vacant');
  });
});

describe('Housekeeping adapter — Cloudbeds', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('cloudbeds', 'housekeeping', cloudbedsHKResponse);
    expect(result.length).toBe(1);
    assertHKShape(result[0]);
    expect(result[0].pmsSource).toBe('cloudbeds');
    expect(result[0].housekeepingStatus).toBe('dirty');
    expect(result[0].occupancyStatus).toBe('occupied');
  });
});

describe('Housekeeping adapter — Opera', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('opera', 'housekeeping', operaHKResponse);
    expect(result.length).toBe(1);
    assertHKShape(result[0]);
    expect(result[0].pmsSource).toBe('opera');
    expect(result[0].housekeepingStatus).toBe('clean');
  });
});

describe('Housekeeping adapter — HotelRunner', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('hotelrunner', 'housekeeping', hotelrunnerHKResponse);
    expect(result.length).toBe(1);
    assertHKShape(result[0]);
    expect(result[0].pmsSource).toBe('hotelrunner');
    expect(result[0].occupancyStatus).toBe('vacant');
  });
});

describe('Housekeeping adapter — Electro', () => {
  it('parses envelope response', () => {
    const result = parseFromPMS('electro', 'housekeeping', electroHKResponse);
    expect(result.length).toBe(1);
    assertHKShape(result[0]);
    expect(result[0].pmsSource).toBe('electro');
    expect(result[0].housekeepingStatus).toBe('inspected');
    expect(result[0].occupancyStatus).toBe('due_out');
  });

  it('parses flat array', () => {
    const result = parseFromPMS('electro', 'housekeeping', electroHKResponse.rooms);
    expect(result.length).toBe(1);
  });
});
