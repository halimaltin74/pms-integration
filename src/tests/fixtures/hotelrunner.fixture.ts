/** Sample HotelRunner room type responses */

export const hotelrunnerFullResponse = {
  data: {
    room_types: [
      {
        room_type_id: 'hr-101',
        name: 'Standard Double',
        short_name: 'SD',
        capacity: 2,
        default_capacity: 2,
        room_count: 8,
        description: 'Comfortable standard double room',
        is_active: true,
        bed_type: 'double',
        amenities: ['WiFi', 'Air conditioning'],
      },
      {
        room_type_id: 'hr-202',
        name: 'Family Room',
        short_name: 'FR',
        capacity: '4',
        room_count: '3',
        description: 'Spacious room for families',
        is_active: 1,
        bed_type: 'twin',
      },
    ],
  },
};

/** Array */
export const hotelrunnerArrayResponse = hotelrunnerFullResponse.data.room_types;

/** Minimal */
export const hotelrunnerMinimalEntry = {
  room_type_id: 'min-1',
};

/** String active flag */
export const hotelrunnerStringActiveEntry = {
  room_type_id: 'str-active',
  name: 'Active String Room',
  capacity: 2,
  room_count: 1,
  is_active: 'active',
};
