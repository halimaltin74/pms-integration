/** Sample Electro PMS room type responses (assumed format) */

export const electroFullResponse = {
  roomTypes: [
    {
      id: 'elec-001',
      name: 'Superior King',
      code: 'SK',
      description: 'Superior king room with city view',
      maxOccupancy: 2,
      defaultOccupancy: 2,
      bedType: 'king',
      totalRooms: 12,
      active: true,
      amenities: ['WiFi', 'Mini Bar'],
    },
    {
      id: 'elec-002',
      name: 'Twin Budget',
      code: 'TB',
      description: 'Economy twin room',
      maxOccupancy: 2,
      defaultOccupancy: 2,
      bedType: 'twin',
      totalRooms: 20,
      active: true,
    },
  ],
};

/** Array */
export const electroArrayResponse = electroFullResponse.roomTypes;

/** Minimal */
export const electroMinimalEntry = {
  id: 'min-elec',
};
