/** Sample Cloudbeds GET /v1.2/getRoomTypes response */

export const cloudbedsFullResponse = {
  success: true,
  data: [
    {
      roomTypeID: '12345',
      roomTypeName: 'Deluxe Double',
      roomTypeShortName: 'DD',
      maxGuests: 2,
      roomsCount: '10',
      roomTypeDescription: 'Sea view room with balcony',
      isActive: true,
      bedType: 'Double',
    },
    {
      roomTypeID: '99999',
      roomTypeName: 'Family Suite',
      roomTypeShortName: 'FS',
      maxGuests: '4',
      roomsCount: '3',
      roomTypeDescription: 'Spacious family suite with two bedrooms',
      isActive: '1',
      bedType: 'king',
      amenities: ['WiFi', 'Breakfast', 'Pool access'],
    },
  ],
};

/** Array passed directly */
export const cloudbedsArrayResponse = cloudbedsFullResponse.data;

/** Minimal — missing most optional fields */
export const cloudbedsMinimalEntry = {
  roomTypeID: 'min-001',
  // name, guests, count all missing
};

/** String boolean for isActive */
export const cloudbedsStringBoolEntry = {
  roomTypeID: 'str-bool',
  roomTypeName: 'Test Room',
  maxGuests: 2,
  roomsCount: 5,
  isActive: 'false',
};
