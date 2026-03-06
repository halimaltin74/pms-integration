/** Sample Mews /getProperties response (spaceTypes portion) */

export const mewsFullResponse = {
  spaceTypes: [
    {
      Id: '5ee074b1-49a5-4ab3-9c72-3dfa17b15b5b',
      Names: { 'en-US': 'Deluxe Double Room', 'tr-TR': 'Deluxe Çift Kişilik' },
      ShortNames: { 'en-US': 'DDR' },
      Description: { 'en-US': 'Sea view room with panoramic windows' },
      Capacity: 2,
      ExtraCapacity: 1,
      SpaceCount: 10,
      IsActive: true,
    },
    {
      Id: 'a1b2c3d4-0000-1111-2222-333333333333',
      Names: { 'en-US': 'Standard Single' },
      Description: { 'en-US': 'Compact single room' },
      Capacity: 1,
      ExtraCapacity: 0,
      SpaceCount: 5,
      IsActive: true,
    },
  ],
};

/** Just the array (no envelope) */
export const mewsArrayResponse = mewsFullResponse.spaceTypes;

/** Missing optional fields */
export const mewsMinimalEntry = {
  Id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  // Names, Description, Capacity, ExtraCapacity, SpaceCount all missing
  IsActive: false,
};

/** Completely invalid entry (missing required Id) */
export const mewsInvalidEntry = {
  Names: { 'en-US': 'No ID Room' },
  Capacity: 2,
};
