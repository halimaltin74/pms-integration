/** Sample Oracle OPERA Cloud (OHIP) roomTypes response */

export const operaFullResponse = {
  roomTypes: {
    roomTypeInfo: [
      {
        roomType: 'DD',
        roomTypeDescription: 'Deluxe Double',
        roomClass: 'DELUXE',
        maxOccupancy: 2,
        bedType: 'Double',
        roomsInInventory: 10,
        activeFlag: 'Y',
      },
      {
        roomType: 'KS',
        roomTypeDescription: 'King Suite',
        roomClass: 'SUITE',
        maxOccupancy: 3,
        bedType: '4', // OTA code for King
        roomsInInventory: 5,
        activeFlag: 'Y',
        amenities: ['Sea View', 'Jacuzzi'],
      },
      {
        roomType: 'STD',
        roomTypeDescription: 'Standard Room',
        roomClass: 'STANDARD',
        maxOccupancy: 2,
        bedType: 'Twin',
        roomsInInventory: '20',
        activeFlag: 'N',
      },
    ],
  },
};

/** Flat array */
export const operaArrayResponse = operaFullResponse.roomTypes.roomTypeInfo;

/** Missing description */
export const operaMinimalEntry = {
  roomType: 'MIN',
  activeFlag: 'Y',
};

/** Numeric string maxOccupancy */
export const operaStringNumberEntry = {
  roomType: 'STR',
  roomTypeDescription: 'String Number Room',
  maxOccupancy: '3',
  bedType: 'Queen',
  roomsInInventory: '8',
  activeFlag: 'Y',
};
