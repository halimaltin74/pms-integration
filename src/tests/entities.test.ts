/**
 * Tests for Property, Reservation, Rate, Availability, Guest entities
 * across all 5 PMS adapters.
 */

import { parseFromPMS } from '../parser';
import { CanonicalProperty } from '../types/property.canonical';
import { CanonicalReservation } from '../types/reservation.canonical';
import { CanonicalRate } from '../types/rate.canonical';
import { CanonicalAvailability } from '../types/availability.canonical';
import { CanonicalGuest } from '../types/guest.canonical';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MEWS_PROPERTY = {
  hotels: [{
    Id: 'hotel-uuid-001',
    Name: { 'en-US': 'Mews Grand Hotel', 'tr-TR': 'Mews Büyük Otel' },
    Description: { 'en-US': 'A beautiful hotel in the city centre' },
    Address: { Line1: '1 Main St', City: 'Istanbul', CountryCode: 'TR', PostalCode: '34000', Latitude: 41.0, Longitude: 28.0 },
    Email: 'hotel@mews.com',
    Telephone: '+90 212 000 0000',
    WebsiteUrl: 'https://mews-hotel.com',
    TimeZoneIdentifier: 'Europe/Istanbul',
    DefaultCurrencyCode: 'EUR',
    CheckInTime: '14:00',
    CheckOutTime: '12:00',
    IsActive: true,
  }],
};

const MEWS_RESERVATIONS = {
  reservations: [
    {
      Id: 'res-uuid-001',
      Number: 'RES-001',
      StartUtc: '2024-06-01T12:00:00Z',
      EndUtc: '2024-06-05T12:00:00Z',
      AdultCount: 2,
      ChildCount: 1,
      State: 'Confirmed',
      RateId: 'rate-uuid-001',
      RequestedCategoryId: 'cat-uuid-001',
      AssignedSpaceId: 'space-uuid-001',
      CustomerId: 'cust-uuid-001',
      Origin: 'Booking.com',
      Notes: 'Late arrival expected',
      Amount: { Currency: 'EUR', Value: 450.00 },
      Deposit: { Value: 100.00 },
      CreatedUtc: '2024-05-15T10:00:00Z',
      UpdatedUtc: '2024-05-16T10:00:00Z',
    },
  ],
};

const MEWS_RATES = {
  rates: [{
    Id: 'rate-uuid-001',
    ServiceId: 'hotel-uuid-001',
    SpaceTypeCategoryId: 'cat-uuid-001',
    Name: { 'en-US': 'Best Available Rate' },
    ShortName: { 'en-US': 'BAR' },
    Description: { 'en-US': 'Our most flexible rate' },
    IsActive: true,
    Currency: 'EUR',
    BaseAmount: 150.00,
    MinimumNights: 1,
    MaximumNights: 30,
    CancellationPolicy: 'Free cancellation up to 24h before arrival',
    MealType: 'Breakfast',
    IsRefundable: true,
  }],
};

const MEWS_AVAILABILITY = {
  propertyId: 'hotel-uuid-001',
  categoryAvailabilities: [{
    CategoryId: 'cat-uuid-001',
    Availabilities: { '2024-06-01': 5, '2024-06-02': 3, '2024-06-03': 8 },
    ClosedDates: ['2024-06-03'],
    MinimumNights: { '2024-06-01': 2 },
  }],
};

const MEWS_GUESTS = {
  customers: [{
    Id: 'cust-uuid-001',
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john.doe@example.com',
    Phone: '+1 555 000 0000',
    NationalityCode: 'US',
    BirthDateUtc: '1990-06-15T00:00:00Z',
    Sex: 'Male',
    LanguageCode: 'en',
    Notes: 'Prefers high floor',
    IsVip: false,
    IdentityDocuments: [{ Type: 'Passport', Number: 'A1234567' }],
  }],
};

const CLOUDBEDS_PROPERTY = {
  success: true,
  data: {
    propertyID: 'cb-prop-001',
    propertyName: 'Cloudbeds Boutique Hotel',
    propertyDescription: 'Charming boutique hotel',
    propertyAddress: '55 Sea Ave',
    propertyCity: 'Antalya',
    propertyCountryCode: 'TR',
    propertyPostalCode: '07000',
    propertyPhone: '+90 242 000 0000',
    propertyEmail: 'info@cb-hotel.com',
    propertyWebsite: 'https://cb-hotel.com',
    propertyTimezone: 'Europe/Istanbul',
    propertyCurrency: 'USD',
    propertyCheckInTime: '15:00',
    propertyCheckOutTime: '11:00',
    propertyLat: '36.8',
    propertyLng: '30.7',
  },
};

const CLOUDBEDS_RESERVATIONS = {
  success: true,
  data: [{
    reservationID: 'cb-res-001',
    guestID: 'cb-guest-001',
    propertyID: 'cb-prop-001',
    roomTypeID: '12345',
    roomID: 'room-101',
    ratePlanID: 'rate-001',
    confirmationNum: 'CONF-CB-001',
    status: 'confirmed',
    checkIn: '2024-07-10',
    checkOut: '2024-07-15',
    adults: '2',
    children: '0',
    grandTotal: '750.00',
    balance: '0.00',
    currency: 'USD',
    source: 'Expedia',
    notes: 'Room upgrade requested',
    createdDate: '2024-06-01',
    modifiedDate: '2024-06-02',
  }],
};

const CLOUDBEDS_RATES = {
  success: true,
  data: [{
    ratePlanID: 'rate-001',
    propertyID: 'cb-prop-001',
    roomTypeID: '12345',
    ratePlanName: 'Summer Special',
    ratePlanShortName: 'SS',
    ratePlanDescription: 'Discounted summer rate',
    currency: 'USD',
    defaultPrice: '125.00',
    minStay: '2',
    maxStay: '14',
    isActive: true,
    mealType: 'Breakfast',
    cancellationPolicy: '48h notice required',
    isRefundable: true,
  }],
};

const CLOUDBEDS_AVAILABILITY = {
  success: true,
  data: [{
    roomTypeID: '12345',
    propertyID: 'cb-prop-001',
    date: '2024-07-10',
    available: '3',
    totalRooms: '10',
    isOpen: true,
    minStay: 2,
    price: '125.00',
    currency: 'USD',
    ratePlanID: 'rate-001',
  }],
};

const CLOUDBEDS_GUESTS = {
  success: true,
  data: [{
    guestID: 'cb-guest-001',
    guestFirstName: 'Maria',
    guestLastName: 'Garcia',
    guestEmail: 'maria.garcia@example.com',
    guestPhone: '+34 600 000 000',
    guestCountry: 'ES',
    guestDateOfBirth: '1985-03-20',
    guestGender: 'female',
    guestDocumentType: 'passport',
    guestDocumentNumber: 'ES123456',
  }],
};

const OPERA_PROPERTY = {
  hotelInfo: {
    hotelCode: 'OPERA001',
    hotelName: 'Opera Grand',
    hotelDescription: 'Luxury hotel',
    address: {
      addressLine1: '10 Opera Square',
      cityName: 'Ankara',
      countryCode: 'TR',
      postalCode: '06000',
      latitude: 39.9,
      longitude: 32.8,
    },
    contactNumbers: [{ phoneNumber: '+90 312 000 0000', phoneType: 'PHONE' }],
    hotelEmail: 'info@opera-grand.com',
    timeZone: 'Europe/Istanbul',
    currency: 'EUR',
    checkInTime: '14:00',
    checkOutTime: '11:00',
  },
};

const OPERA_RESERVATIONS = {
  reservations: {
    reservation: [{
      reservationId: 'OPERA-RES-001',
      hotelId: 'OPERA001',
      confirmationNumber: 'CONF-OPERA-001',
      reservationStatus: 'RESERVED',
      roomStay: {
        roomType: 'DD',
        roomId: '201',
        checkInDate: '2024-08-01',
        checkOutDate: '2024-08-05',
        ratePlanCode: 'BAR',
        guestCounts: { adults: 2, children: 0 },
      },
      guestProfile: { profileId: 'PROF-001', firstName: 'James', lastName: 'Bond' },
      totalAmount: { amount: '600.00', currencyCode: 'EUR' },
      depositAmount: { amount: '200.00' },
      bookingChannel: 'OTA',
      creationDate: '2024-07-01',
      lastModifyDateTime: '2024-07-02T10:00:00',
    }],
  },
};

const OPERA_RATES = {
  ratePlans: {
    ratePlan: [{
      ratePlanCode: 'BAR',
      hotelId: 'OPERA001',
      roomType: 'DD',
      ratePlanName: 'Best Available Rate',
      ratePlanDescription: 'Flexible best rate',
      currency: 'EUR',
      rateAmount: 150.00,
      minimumStay: 1,
      maximumStay: 0,
      activeFlag: 'Y',
      mealPlan: 'BREAKFAST',
      cancellationPolicy: 'Free cancellation 24h before',
      isRefundable: 'Y',
    }],
  },
};

const OPERA_AVAILABILITY = {
  availability: [{
    roomType: 'DD',
    hotelId: 'OPERA001',
    date: '2024-08-01',
    available: 4,
    totalInventory: 10,
    housekeepingStatus: 'OPEN',
    minimumStayThrough: 2,
    rateAmount: 150.00,
    currencyCode: 'EUR',
    ratePlanCode: 'BAR',
  }],
};

const OPERA_GUESTS = {
  profiles: {
    profile: [{
      profileId: 'PROF-001',
      profileType: 'GUEST',
      firstName: 'James',
      lastName: 'Bond',
      email: 'james.bond@mi6.gov.uk',
      phones: [{ phoneNumber: '+44 7700 000000', phoneType: 'PHONE' }],
      nationality: 'GB',
      dateOfBirth: '1968-04-05',
      gender: 'MALE',
      documentType: 'PASSPORT',
      documentNumber: 'GB654321',
      language: 'en',
      vipStatus: 'VIP',
    }],
  },
};

const HR_PROPERTY = {
  data: {
    property: {
      property_id: 'hr-prop-001',
      name: 'HotelRunner Seaside',
      description: 'Stunning sea-view property',
      address: { street: '1 Beach Rd', city: 'Bodrum', country: 'TR', postal_code: '48000', latitude: 37.0, longitude: 27.4 },
      phone: '+90 252 000 0000',
      email: 'info@hr-seaside.com',
      timezone: 'Europe/Istanbul',
      currency: 'TRY',
      check_in_time: '15:00',
      check_out_time: '12:00',
      is_active: true,
    },
  },
};

const HR_RESERVATIONS = {
  data: {
    reservations: [{
      reservation_id: 'hr-res-001',
      property_id: 'hr-prop-001',
      room_type_id: 'hr-101',
      room_id: 'hr-room-1',
      guest_id: 'hr-guest-001',
      rate_plan_id: 'hr-rate-001',
      confirmation_number: 'CONF-HR-001',
      status: 'confirmed',
      check_in: '2024-09-10',
      check_out: '2024-09-14',
      adults: 2,
      children: 1,
      total_amount: '3200.00',
      paid_amount: '3200.00',
      currency: 'TRY',
      source: 'direct',
      created_at: '2024-08-01T10:00:00',
      updated_at: '2024-08-01T10:00:00',
    }],
  },
};

const HR_RATES = {
  data: {
    rate_plans: [{
      rate_plan_id: 'hr-rate-001',
      property_id: 'hr-prop-001',
      room_type_id: 'hr-101',
      name: 'Standard Rate',
      short_name: 'STD',
      currency: 'TRY',
      base_price: '800.00',
      min_stay: 2,
      max_stay: 0,
      is_active: true,
      meal_plan: 'breakfast',
      cancellation_policy: 'Non-refundable',
      is_refundable: false,
    }],
  },
};

const HR_AVAILABILITY = {
  data: {
    availability: [{
      room_type_id: 'hr-101',
      property_id: 'hr-prop-001',
      date: '2024-09-10',
      available_rooms: 2,
      total_rooms: 8,
      is_open: true,
      min_stay: 2,
      price: '800.00',
      currency: 'TRY',
      rate_plan_id: 'hr-rate-001',
    }],
  },
};

const HR_GUESTS = {
  data: {
    guests: [{
      guest_id: 'hr-guest-001',
      first_name: 'Ayşe',
      last_name: 'Yılmaz',
      email: 'ayse@example.com',
      phone: '+90 530 000 0000',
      nationality: 'TR',
      date_of_birth: '1992-07-22',
      gender: 'female',
      id_type: 'id_card',
      id_number: 'TR9876543',
      is_vip: false,
    }],
  },
};

const ELECTRO_PROPERTY = {
  properties: [{
    id: 'elec-prop-001',
    name: 'Electro City Hotel',
    description: 'Modern urban hotel',
    address: { line1: '99 Tech Blvd', city: 'Izmir', country: 'TR', postalCode: '35000', lat: 38.4, lng: 27.1 },
    phone: '+90 232 000 0000',
    email: 'info@electro-city.com',
    website: 'https://electro-city.com',
    timezone: 'Europe/Istanbul',
    currency: 'EUR',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    totalRooms: 60,
    active: true,
    amenities: ['WiFi', 'Gym', 'Spa'],
  }],
};

const ELECTRO_RESERVATIONS = {
  reservations: [{
    id: 'elec-res-001',
    propertyId: 'elec-prop-001',
    roomTypeId: 'elec-001',
    roomId: 'elec-room-1',
    guestId: 'elec-guest-001',
    rateId: 'elec-rate-001',
    confirmationNumber: 'CONF-ELEC-001',
    status: 'confirmed',
    checkIn: '2024-10-05',
    checkOut: '2024-10-10',
    adults: 2,
    children: 0,
    totalAmount: 750.00,
    paidAmount: 750.00,
    currency: 'EUR',
    source: 'direct',
    createdAt: '2024-09-01T09:00:00Z',
    updatedAt: '2024-09-01T09:00:00Z',
  }],
};

const ELECTRO_RATES = {
  rates: [{
    id: 'elec-rate-001',
    propertyId: 'elec-prop-001',
    roomTypeId: 'elec-001',
    name: 'Flex Rate',
    code: 'FLEX',
    description: 'Flexible cancellation rate',
    currency: 'EUR',
    basePrice: 150.00,
    minStay: 1,
    maxStay: 0,
    active: true,
    mealPlan: 'none',
    cancellationPolicy: 'Free cancellation 48h before',
    isRefundable: true,
  }],
};

const ELECTRO_AVAILABILITY = {
  availability: [{
    roomTypeId: 'elec-001',
    propertyId: 'elec-prop-001',
    date: '2024-10-05',
    availableRooms: 6,
    totalRooms: 12,
    isOpen: true,
    minStay: 1,
    maxStay: 0,
    price: 150.00,
    currency: 'EUR',
    rateId: 'elec-rate-001',
  }],
};

const ELECTRO_GUESTS = {
  guests: [{
    id: 'elec-guest-001',
    firstName: 'Sophie',
    lastName: 'Martin',
    email: 'sophie.martin@example.fr',
    phone: '+33 6 00 00 00 00',
    nationality: 'FR',
    dateOfBirth: '1995-11-30',
    gender: 'female',
    idType: 'passport',
    idNumber: 'FR555777',
    language: 'fr',
    isVip: true,
    address: { line1: '12 Rue de la Paix', city: 'Paris', country: 'FR', postalCode: '75001' },
  }],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function assertBaseShape(obj: { id: string; externalId: string; pmsSource: string; rawData: object }) {
  expect(typeof obj.id).toBe('string');
  expect(obj.id.length).toBeGreaterThan(0);
  expect(typeof obj.externalId).toBe('string');
  expect(typeof obj.pmsSource).toBe('string');
  expect(typeof obj.rawData).toBe('object');
}

// ===========================================================================
// PROPERTIES
// ===========================================================================

describe('Properties', () => {
  const PMS_FIXTURES: Array<[string, unknown, string, string]> = [
    ['mews',        MEWS_PROPERTY,   'hotel-uuid-001', 'Mews Grand Hotel'],
    ['cloudbeds',   CLOUDBEDS_PROPERTY, 'cb-prop-001', 'Cloudbeds Boutique Hotel'],
    ['opera',       OPERA_PROPERTY,  'OPERA001',       'Opera Grand'],
    ['hotelrunner', HR_PROPERTY,     'hr-prop-001',    'HotelRunner Seaside'],
    ['electro',     ELECTRO_PROPERTY,'elec-prop-001',  'Electro City Hotel'],
  ];

  test.each(PMS_FIXTURES)('%s: parses property correctly', (source, fixture, extId, name) => {
    const results = parseFromPMS(source as any, 'properties', fixture) as CanonicalProperty[];
    expect(results).toHaveLength(1);
    assertBaseShape(results[0]);
    expect(results[0].pmsSource).toBe(source);
    expect(results[0].externalId).toBe(extId);
    expect(results[0].name).toBe(name);
    expect(typeof results[0].checkInTime).toBe('string');
    expect(typeof results[0].checkOutTime).toBe('string');
    expect(typeof results[0].isActive).toBe('boolean');
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it('Mews: maps address fields', () => {
    const [p] = parseFromPMS('mews', 'properties', MEWS_PROPERTY);
    expect(p.address.city).toBe('Istanbul');
    expect(p.address.country).toBe('TR');
    expect(p.address.latitude).toBe(41.0);
    expect(p.currency).toBe('EUR');
    expect(p.timezone).toBe('Europe/Istanbul');
  });

  it('Cloudbeds: coerces string lat/lng to number', () => {
    const [p] = parseFromPMS('cloudbeds', 'properties', CLOUDBEDS_PROPERTY);
    expect(typeof p.address.latitude).toBe('number');
    expect(p.address.latitude).toBeCloseTo(36.8);
  });

  it('Opera: extracts phone from contactNumbers array', () => {
    const [p] = parseFromPMS('opera', 'properties', OPERA_PROPERTY);
    expect(p.phone).toBe('+90 312 000 0000');
  });

  it('Electro: parses amenities', () => {
    const [p] = parseFromPMS('electro', 'properties', ELECTRO_PROPERTY);
    expect(p.amenities).toEqual(['WiFi', 'Gym', 'Spa']);
    expect(p.totalRooms).toBe(60);
  });
});

// ===========================================================================
// RESERVATIONS
// ===========================================================================

describe('Reservations', () => {
  const PMS_FIXTURES: Array<[string, unknown, string]> = [
    ['mews',        MEWS_RESERVATIONS,  'res-uuid-001'],
    ['cloudbeds',   CLOUDBEDS_RESERVATIONS, 'cb-res-001'],
    ['opera',       OPERA_RESERVATIONS, 'OPERA-RES-001'],
    ['hotelrunner', HR_RESERVATIONS,    'hr-res-001'],
    ['electro',     ELECTRO_RESERVATIONS, 'elec-res-001'],
  ];

  test.each(PMS_FIXTURES)('%s: parses reservation correctly', (source, fixture, extId) => {
    const results = parseFromPMS(source as any, 'reservations', fixture) as CanonicalReservation[];
    expect(results).toHaveLength(1);
    assertBaseShape(results[0]);
    expect(results[0].pmsSource).toBe(source);
    expect(results[0].externalId).toBe(extId);
    expect(['pending','confirmed','checked_in','checked_out','cancelled','no_show']).toContain(results[0].status);
    expect(typeof results[0].checkIn).toBe('string');
    expect(typeof results[0].checkOut).toBe('string');
    expect(typeof results[0].nights).toBe('number');
    expect(results[0].nights).toBeGreaterThan(0);
    expect(typeof results[0].totalAmount).toBe('number');
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it('Mews: maps fields correctly', () => {
    const [r] = parseFromPMS('mews', 'reservations', MEWS_RESERVATIONS);
    expect(r.confirmationNumber).toBe('RES-001');
    expect(r.status).toBe('confirmed');
    expect(r.checkIn).toBe('2024-06-01');
    expect(r.checkOut).toBe('2024-06-05');
    expect(r.nights).toBe(4);
    expect(r.adults).toBe(2);
    expect(r.children).toBe(1);
    expect(r.currency).toBe('EUR');
    expect(r.totalAmount).toBe(450);
    expect(r.paidAmount).toBe(100);
    expect(r.outstandingAmount).toBe(350);
    expect(r.source).toBe('Booking.com');
  });

  it('Cloudbeds: calculates paid from grandTotal - balance', () => {
    const [r] = parseFromPMS('cloudbeds', 'reservations', CLOUDBEDS_RESERVATIONS);
    expect(r.totalAmount).toBe(750);
    expect(r.outstandingAmount).toBe(0);
    expect(r.status).toBe('confirmed');
    expect(r.nights).toBe(5);
  });

  it('Opera: maps RESERVED → confirmed, nested roomStay', () => {
    const [r] = parseFromPMS('opera', 'reservations', OPERA_RESERVATIONS);
    expect(r.status).toBe('confirmed');
    expect(r.roomTypeExternalId).toBe('DD');
    expect(r.roomExternalId).toBe('201');
    expect(r.nights).toBe(4);
  });

  it('HotelRunner: calculates outstanding correctly', () => {
    const [r] = parseFromPMS('hotelrunner', 'reservations', HR_RESERVATIONS);
    expect(r.paidAmount).toBe(3200);
    expect(r.outstandingAmount).toBe(0);
    expect(r.nights).toBe(4);
  });

  it('Electro: maps confirmationNumber', () => {
    const [r] = parseFromPMS('electro', 'reservations', ELECTRO_RESERVATIONS);
    expect(r.confirmationNumber).toBe('CONF-ELEC-001');
    expect(r.nights).toBe(5);
  });
});

// ===========================================================================
// RATES
// ===========================================================================

describe('Rates', () => {
  const PMS_FIXTURES: Array<[string, unknown, string]> = [
    ['mews',        MEWS_RATES,        'rate-uuid-001'],
    ['cloudbeds',   CLOUDBEDS_RATES,   'rate-001'],
    ['opera',       OPERA_RATES,       'BAR'],
    ['hotelrunner', HR_RATES,          'hr-rate-001'],
    ['electro',     ELECTRO_RATES,     'elec-rate-001'],
  ];

  test.each(PMS_FIXTURES)('%s: parses rate correctly', (source, fixture, extId) => {
    const results = parseFromPMS(source as any, 'rates', fixture) as CanonicalRate[];
    expect(results).toHaveLength(1);
    assertBaseShape(results[0]);
    expect(results[0].pmsSource).toBe(source);
    expect(results[0].externalId).toBe(extId);
    expect(typeof results[0].basePrice).toBe('number');
    expect(typeof results[0].isActive).toBe('boolean');
    expect(['none','breakfast','half_board','full_board','all_inclusive']).toContain(results[0].mealPlan);
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it('Mews: maps meal type Breakfast', () => {
    const [r] = parseFromPMS('mews', 'rates', MEWS_RATES);
    expect(r.mealPlan).toBe('breakfast');
    expect(r.basePrice).toBe(150);
    expect(r.isRefundable).toBe(true);
  });

  it('Cloudbeds: coerces string price', () => {
    const [r] = parseFromPMS('cloudbeds', 'rates', CLOUDBEDS_RATES);
    expect(r.basePrice).toBe(125);
    expect(r.minStay).toBe(2);
    expect(r.maxStay).toBe(14);
  });

  it('Opera: maps activeFlag Y → isActive true and isRefundable Y', () => {
    const [r] = parseFromPMS('opera', 'rates', OPERA_RATES);
    expect(r.isActive).toBe(true);
    expect(r.isRefundable).toBe(true);
    expect(r.mealPlan).toBe('breakfast');
  });

  it('HotelRunner: is_refundable false', () => {
    const [r] = parseFromPMS('hotelrunner', 'rates', HR_RATES);
    expect(r.isRefundable).toBe(false);
    expect(r.mealPlan).toBe('breakfast');
  });
});

// ===========================================================================
// AVAILABILITY
// ===========================================================================

describe('Availability', () => {
  const PMS_FIXTURES: Array<[string, unknown]> = [
    ['mews',        MEWS_AVAILABILITY],
    ['cloudbeds',   CLOUDBEDS_AVAILABILITY],
    ['opera',       OPERA_AVAILABILITY],
    ['hotelrunner', HR_AVAILABILITY],
    ['electro',     ELECTRO_AVAILABILITY],
  ];

  test.each(PMS_FIXTURES)('%s: parses availability correctly', (source, fixture) => {
    const results = parseFromPMS(source as any, 'availability', fixture) as CanonicalAvailability[];
    expect(results.length).toBeGreaterThan(0);
    results.forEach(a => {
      expect(typeof a.id).toBe('string');
      expect(a.pmsSource).toBe(source);
      expect(typeof a.date).toBe('string');
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof a.availableRooms).toBe('number');
      expect(typeof a.isOpen).toBe('boolean');
      expect(Array.isArray(a.prices)).toBe(true);
    });
  });

  it('Mews: flattens date-keyed object into records', () => {
    const avails = parseFromPMS('mews', 'availability', MEWS_AVAILABILITY);
    expect(avails).toHaveLength(3); // 3 dates
    expect(avails.find(a => a.date === '2024-06-01')?.availableRooms).toBe(5);
    expect(avails.find(a => a.date === '2024-06-03')?.isOpen).toBe(false); // ClosedDate
  });

  it('Mews: applies MinimumNights per date', () => {
    const avails = parseFromPMS('mews', 'availability', MEWS_AVAILABILITY);
    expect(avails.find(a => a.date === '2024-06-01')?.minStay).toBe(2);
  });

  it('Cloudbeds: includes price in prices array', () => {
    const [a] = parseFromPMS('cloudbeds', 'availability', CLOUDBEDS_AVAILABILITY);
    expect(a.prices).toHaveLength(1);
    expect(a.prices[0].price).toBe(125);
    expect(a.prices[0].currency).toBe('USD');
  });

  it('Opera: maps housekeepingStatus OPEN → isOpen true', () => {
    const [a] = parseFromPMS('opera', 'availability', OPERA_AVAILABILITY);
    expect(a.isOpen).toBe(true);
    expect(a.minStay).toBe(2);
    expect(a.prices[0].rateExternalId).toBe('BAR');
  });

  it('id is deterministic (same input = same id)', () => {
    const [a1] = parseFromPMS('opera', 'availability', OPERA_AVAILABILITY);
    const [a2] = parseFromPMS('opera', 'availability', OPERA_AVAILABILITY);
    expect(a1.id).toBe(a2.id);
  });
});

// ===========================================================================
// GUESTS
// ===========================================================================

describe('Guests', () => {
  const PMS_FIXTURES: Array<[string, unknown, string]> = [
    ['mews',        MEWS_GUESTS,       'cust-uuid-001'],
    ['cloudbeds',   CLOUDBEDS_GUESTS,  'cb-guest-001'],
    ['opera',       OPERA_GUESTS,      'PROF-001'],
    ['hotelrunner', HR_GUESTS,         'hr-guest-001'],
    ['electro',     ELECTRO_GUESTS,    'elec-guest-001'],
  ];

  test.each(PMS_FIXTURES)('%s: parses guest correctly', (source, fixture, extId) => {
    const results = parseFromPMS(source as any, 'guests', fixture) as CanonicalGuest[];
    expect(results).toHaveLength(1);
    assertBaseShape(results[0]);
    expect(results[0].pmsSource).toBe(source);
    expect(results[0].externalId).toBe(extId);
    expect(['male','female','other','unknown']).toContain(results[0].gender);
    expect(['passport','id_card','driving_license','other','unknown']).toContain(results[0].idType);
    expect(typeof results[0].fullName).toBe('string');
    expect(typeof results[0].isVip).toBe('boolean');
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it('Mews: maps Sex Male → gender male, Passport doc', () => {
    const [g] = parseFromPMS('mews', 'guests', MEWS_GUESTS);
    expect(g.firstName).toBe('John');
    expect(g.lastName).toBe('Doe');
    expect(g.fullName).toBe('John Doe');
    expect(g.gender).toBe('male');
    expect(g.idType).toBe('passport');
    expect(g.idNumber).toBe('A1234567');
    expect(g.dateOfBirth).toBe('1990-06-15');
    expect(g.nationality).toBe('US');
  });

  it('Cloudbeds: maps guestGender female → female', () => {
    const [g] = parseFromPMS('cloudbeds', 'guests', CLOUDBEDS_GUESTS);
    expect(g.gender).toBe('female');
    expect(g.nationality).toBe('ES');
  });

  it('Opera: maps PASSPORT doc type, VIP status', () => {
    const [g] = parseFromPMS('opera', 'guests', OPERA_GUESTS);
    expect(g.idType).toBe('passport');
    expect(g.isVip).toBe(true);
    expect(g.fullName).toBe('James Bond');
  });

  it('HotelRunner: maps id_card type', () => {
    const [g] = parseFromPMS('hotelrunner', 'guests', HR_GUESTS);
    expect(g.idType).toBe('id_card');
    expect(g.gender).toBe('female');
    expect(g.nationality).toBe('TR');
  });

  it('Electro: isVip true, address mapped', () => {
    const [g] = parseFromPMS('electro', 'guests', ELECTRO_GUESTS);
    expect(g.isVip).toBe(true);
    expect(g.address.city).toBe('Paris');
    expect(g.language).toBe('fr');
  });
});
