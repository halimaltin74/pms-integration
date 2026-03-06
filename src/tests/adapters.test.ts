import { parseFromPMS, detectPMSFormat } from '../parser';
import { CanonicalRoomType } from '../types/canonical';

import {
  mewsFullResponse,
  mewsArrayResponse,
  mewsMinimalEntry,
  mewsInvalidEntry,
} from './fixtures/mews.fixture';
import {
  cloudbedsFullResponse,
  cloudbedsArrayResponse,
  cloudbedsMinimalEntry,
  cloudbedsStringBoolEntry,
} from './fixtures/cloudbeds.fixture';
import {
  operaFullResponse,
  operaArrayResponse,
  operaMinimalEntry,
  operaStringNumberEntry,
} from './fixtures/opera.fixture';
import {
  hotelrunnerFullResponse,
  hotelrunnerArrayResponse,
  hotelrunnerMinimalEntry,
  hotelrunnerStringActiveEntry,
} from './fixtures/hotelrunner.fixture';
import {
  electroFullResponse,
  electroArrayResponse,
  electroMinimalEntry,
} from './fixtures/electro.fixture';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertCanonicalShape(room: CanonicalRoomType) {
  expect(typeof room.id).toBe('string');
  expect(room.id.length).toBeGreaterThan(0);
  expect(typeof room.externalId).toBe('string');
  expect(typeof room.name).toBe('string');
  expect(typeof room.shortCode).toBe('string');
  expect(typeof room.description).toBe('string');
  expect(typeof room.maxOccupancy).toBe('number');
  expect(typeof room.defaultOccupancy).toBe('number');
  expect(['single', 'double', 'twin', 'king', 'queen', 'bunk', 'sofa', 'unknown']).toContain(room.bedType);
  expect(typeof room.roomCount).toBe('number');
  expect(Array.isArray(room.amenities)).toBe(true);
  expect(typeof room.isActive).toBe('boolean');
  expect(room.confidence).toBeGreaterThanOrEqual(0);
  expect(room.confidence).toBeLessThanOrEqual(1);
  expect(typeof room.rawData).toBe('object');
}

// ===========================================================================
// Mews adapter
// ===========================================================================

describe('Mews adapter', () => {
  it('parses a full envelope response', () => {
    const rooms = parseFromPMS('mews', mewsFullResponse);
    expect(rooms).toHaveLength(2);
    rooms.forEach(assertCanonicalShape);
  });

  it('assigns correct pmsSource', () => {
    const [room] = parseFromPMS('mews', mewsFullResponse);
    expect(room.pmsSource).toBe('mews');
  });

  it('maps fields correctly for the first entry', () => {
    const [room] = parseFromPMS('mews', mewsFullResponse);
    expect(room.externalId).toBe('5ee074b1-49a5-4ab3-9c72-3dfa17b15b5b');
    expect(room.name).toBe('Deluxe Double Room');
    expect(room.shortCode).toBe('DDR');
    expect(room.description).toBe('Sea view room with panoramic windows');
    expect(room.maxOccupancy).toBe(3);     // Capacity(2) + ExtraCapacity(1)
    expect(room.defaultOccupancy).toBe(2); // Capacity only
    expect(room.roomCount).toBe(10);
    expect(room.isActive).toBe(true);
    expect(room.bedType).toBe('unknown'); // Mews CM API doesn't expose bed type
  });

  it('accepts a flat array (no envelope)', () => {
    const rooms = parseFromPMS('mews', mewsArrayResponse);
    expect(rooms).toHaveLength(2);
  });

  it('handles a minimal entry with missing optional fields (warns but does not throw)', () => {
    const rooms = parseFromPMS('mews', [mewsMinimalEntry]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toBe('');
    expect(rooms[0].maxOccupancy).toBe(0);
    expect(rooms[0].isActive).toBe(false);
    expect(rooms[0].confidence).toBeLessThan(0.5);
  });

  it('skips entries missing the required Id field', () => {
    const rooms = parseFromPMS('mews', [mewsInvalidEntry]);
    expect(rooms).toHaveLength(0);
  });

  it('returns empty array for completely invalid input', () => {
    const rooms = parseFromPMS('mews', null);
    expect(rooms).toEqual([]);
  });

  it('confidence is high when all fields are present', () => {
    const [room] = parseFromPMS('mews', mewsFullResponse);
    expect(room.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('id has mews_ prefix', () => {
    const [room] = parseFromPMS('mews', mewsFullResponse);
    expect(room.id).toMatch(/^mews_/);
  });
});

// ===========================================================================
// Cloudbeds adapter
// ===========================================================================

describe('Cloudbeds adapter', () => {
  it('parses a full envelope response', () => {
    const rooms = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    expect(rooms).toHaveLength(2);
    rooms.forEach(assertCanonicalShape);
  });

  it('assigns correct pmsSource', () => {
    const [room] = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    expect(room.pmsSource).toBe('cloudbeds');
  });

  it('maps fields correctly for the first entry', () => {
    const [room] = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    expect(room.externalId).toBe('12345');
    expect(room.name).toBe('Deluxe Double');
    expect(room.shortCode).toBe('DD');
    expect(room.description).toBe('Sea view room with balcony');
    expect(room.maxOccupancy).toBe(2);
    expect(room.roomCount).toBe(10);
    expect(room.isActive).toBe(true);
    expect(room.bedType).toBe('double');
  });

  it('normalises roomsCount numeric strings', () => {
    const [room] = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    expect(typeof room.roomCount).toBe('number');
  });

  it('parses amenities on second entry', () => {
    const rooms = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    expect(rooms[1].amenities).toEqual(['WiFi', 'Breakfast', 'Pool access']);
    expect(rooms[1].bedType).toBe('king');
  });

  it('accepts flat array', () => {
    const rooms = parseFromPMS('cloudbeds', cloudbedsArrayResponse);
    expect(rooms).toHaveLength(2);
  });

  it('handles minimal entry', () => {
    const rooms = parseFromPMS('cloudbeds', [cloudbedsMinimalEntry]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].externalId).toBe('min-001');
    expect(rooms[0].confidence).toBeLessThan(0.3);
  });

  it('coerces string "false" to boolean false for isActive', () => {
    const rooms = parseFromPMS('cloudbeds', [cloudbedsStringBoolEntry]);
    expect(rooms[0].isActive).toBe(false);
  });
});

// ===========================================================================
// Opera adapter
// ===========================================================================

describe('Opera adapter', () => {
  it('parses a full OHIP envelope response', () => {
    const rooms = parseFromPMS('opera', operaFullResponse);
    expect(rooms).toHaveLength(3);
    rooms.forEach(assertCanonicalShape);
  });

  it('assigns correct pmsSource', () => {
    const [room] = parseFromPMS('opera', operaFullResponse);
    expect(room.pmsSource).toBe('opera');
  });

  it('maps fields correctly for the DD room', () => {
    const [room] = parseFromPMS('opera', operaFullResponse);
    expect(room.externalId).toBe('DD');
    expect(room.shortCode).toBe('DD');
    expect(room.name).toBe('Deluxe Double');
    expect(room.description).toContain('DELUXE');
    expect(room.maxOccupancy).toBe(2);
    expect(room.roomCount).toBe(10);
    expect(room.isActive).toBe(true);
    expect(room.bedType).toBe('double');
  });

  it('resolves OTA numeric bed type code "4" to king', () => {
    const rooms = parseFromPMS('opera', operaFullResponse);
    const ks = rooms.find((r) => r.externalId === 'KS')!;
    expect(ks.bedType).toBe('king');
    expect(ks.amenities).toEqual(['Sea View', 'Jacuzzi']);
  });

  it('maps activeFlag "N" to isActive=false', () => {
    const rooms = parseFromPMS('opera', operaFullResponse);
    const std = rooms.find((r) => r.externalId === 'STD')!;
    expect(std.isActive).toBe(false);
    expect(std.bedType).toBe('twin');
  });

  it('accepts flat array', () => {
    const rooms = parseFromPMS('opera', operaArrayResponse);
    expect(rooms).toHaveLength(3);
  });

  it('handles minimal entry (only roomType code)', () => {
    const rooms = parseFromPMS('opera', [operaMinimalEntry]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].externalId).toBe('MIN');
    expect(rooms[0].name).toBe('MIN'); // falls back to shortCode
  });

  it('coerces string numbers for maxOccupancy and roomsInInventory', () => {
    const rooms = parseFromPMS('opera', [operaStringNumberEntry]);
    expect(rooms[0].maxOccupancy).toBe(3);
    expect(rooms[0].roomCount).toBe(8);
    expect(rooms[0].bedType).toBe('queen');
  });
});

// ===========================================================================
// HotelRunner adapter
// ===========================================================================

describe('HotelRunner adapter', () => {
  it('parses a full nested response', () => {
    const rooms = parseFromPMS('hotelrunner', hotelrunnerFullResponse);
    expect(rooms).toHaveLength(2);
    rooms.forEach(assertCanonicalShape);
  });

  it('assigns correct pmsSource', () => {
    const [room] = parseFromPMS('hotelrunner', hotelrunnerFullResponse);
    expect(room.pmsSource).toBe('hotelrunner');
  });

  it('maps fields correctly for the first entry', () => {
    const [room] = parseFromPMS('hotelrunner', hotelrunnerFullResponse);
    expect(room.externalId).toBe('hr-101');
    expect(room.name).toBe('Standard Double');
    expect(room.shortCode).toBe('SD');
    expect(room.description).toBe('Comfortable standard double room');
    expect(room.maxOccupancy).toBe(2);
    expect(room.defaultOccupancy).toBe(2);
    expect(room.roomCount).toBe(8);
    expect(room.isActive).toBe(true);
    expect(room.bedType).toBe('double');
    expect(room.amenities).toEqual(['WiFi', 'Air conditioning']);
  });

  it('coerces capacity string to number', () => {
    const rooms = parseFromPMS('hotelrunner', hotelrunnerFullResponse);
    expect(rooms[1].maxOccupancy).toBe(4);
    expect(typeof rooms[1].roomCount).toBe('number');
  });

  it('coerces numeric 1 to boolean true for is_active', () => {
    const rooms = parseFromPMS('hotelrunner', hotelrunnerFullResponse);
    expect(rooms[1].isActive).toBe(true);
  });

  it('accepts flat array', () => {
    const rooms = parseFromPMS('hotelrunner', hotelrunnerArrayResponse);
    expect(rooms).toHaveLength(2);
  });

  it('handles minimal entry', () => {
    const rooms = parseFromPMS('hotelrunner', [hotelrunnerMinimalEntry]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].confidence).toBeLessThan(0.3);
  });

  it('coerces string "active" to boolean true for is_active', () => {
    const rooms = parseFromPMS('hotelrunner', [hotelrunnerStringActiveEntry]);
    expect(rooms[0].isActive).toBe(true);
  });
});

// ===========================================================================
// Electro adapter
// ===========================================================================

describe('Electro adapter', () => {
  it('parses a full response', () => {
    const rooms = parseFromPMS('electro', electroFullResponse);
    expect(rooms).toHaveLength(2);
    rooms.forEach(assertCanonicalShape);
  });

  it('assigns correct pmsSource', () => {
    const [room] = parseFromPMS('electro', electroFullResponse);
    expect(room.pmsSource).toBe('electro');
  });

  it('maps fields correctly', () => {
    const [room] = parseFromPMS('electro', electroFullResponse);
    expect(room.externalId).toBe('elec-001');
    expect(room.name).toBe('Superior King');
    expect(room.shortCode).toBe('SK');
    expect(room.maxOccupancy).toBe(2);
    expect(room.defaultOccupancy).toBe(2);
    expect(room.bedType).toBe('king');
    expect(room.roomCount).toBe(12);
    expect(room.amenities).toEqual(['WiFi', 'Mini Bar']);
    expect(room.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('accepts flat array', () => {
    const rooms = parseFromPMS('electro', electroArrayResponse);
    expect(rooms).toHaveLength(2);
  });

  it('handles minimal entry', () => {
    const rooms = parseFromPMS('electro', [electroMinimalEntry]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].confidence).toBeLessThan(0.3);
  });
});

// ===========================================================================
// detectPMSFormat
// ===========================================================================

describe('detectPMSFormat', () => {
  it('detects Mews from full envelope', () => {
    expect(detectPMSFormat(mewsFullResponse)).toBe('mews');
  });

  it('detects Mews from array of spaceTypes', () => {
    expect(detectPMSFormat(mewsArrayResponse)).toBe('mews');
  });

  it('detects Cloudbeds from full envelope', () => {
    expect(detectPMSFormat(cloudbedsFullResponse)).toBe('cloudbeds');
  });

  it('detects Cloudbeds from array', () => {
    expect(detectPMSFormat(cloudbedsArrayResponse)).toBe('cloudbeds');
  });

  it('detects Opera from OHIP envelope', () => {
    expect(detectPMSFormat(operaFullResponse)).toBe('opera');
  });

  it('detects Opera from array', () => {
    expect(detectPMSFormat(operaArrayResponse)).toBe('opera');
  });

  it('detects HotelRunner from nested envelope', () => {
    expect(detectPMSFormat(hotelrunnerFullResponse)).toBe('hotelrunner');
  });

  it('detects HotelRunner from array', () => {
    expect(detectPMSFormat(hotelrunnerArrayResponse)).toBe('hotelrunner');
  });

  it('detects Electro from envelope', () => {
    expect(detectPMSFormat(electroFullResponse)).toBe('electro');
  });

  it('returns null for completely unknown shape', () => {
    expect(detectPMSFormat({ totally: 'unknown', shape: true })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(detectPMSFormat(null)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(detectPMSFormat({})).toBeNull();
  });
});

// ===========================================================================
// parseFromPMS — cross-cutting concerns
// ===========================================================================

describe('parseFromPMS — cross-cutting', () => {
  it('returns empty array for an unknown source (never throws)', () => {
    // @ts-expect-error: intentionally passing invalid source for runtime test
    const result = parseFromPMS('unknown_pms', {});
    expect(result).toEqual([]);
  });

  it('rawData is preserved on each canonical record', () => {
    const [room] = parseFromPMS('mews', mewsFullResponse);
    expect(room.rawData['Id']).toBe('5ee074b1-49a5-4ab3-9c72-3dfa17b15b5b');
  });

  it('every parsed room has a unique id', () => {
    const rooms = parseFromPMS('cloudbeds', cloudbedsFullResponse);
    const ids = rooms.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
