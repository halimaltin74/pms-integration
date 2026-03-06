import { z } from 'zod';
import { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from '../types/housekeeping.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const HRRoomSchema = z.object({
  room_id: z.union([z.string(), z.number()]),
  room_number: z.string().optional(),
  floor: z.string().optional(),
  room_type_id: z.union([z.string(), z.number()]).optional(),
  property_id: z.union([z.string(), z.number()]).optional(),
  housekeeping_status: z.string().optional(),
  occupancy_status: z.string().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
  last_cleaned_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough();

const HRHKResponseSchema = z.object({ data: z.object({ rooms: z.array(z.unknown()) }) }).passthrough();

const HK_MAP: Record<string, HousekeepingStatus> = {
  clean: 'clean', dirty: 'dirty', inspected: 'inspected',
  out_of_service: 'out_of_service', out_of_order: 'out_of_order',
};
const OCC_MAP: Record<string, OccupancyStatus> = {
  occupied: 'occupied', vacant: 'vacant', due_out: 'due_out', due_in: 'due_in',
};

function parseRoom(raw: unknown): CanonicalHousekeeping | null {
  const r = HRRoomSchema.safeParse(raw);
  if (!r.success) { logger.warn('HotelRunner: failed to parse room HK', r.error.flatten()); return null; }
  const s = r.data;
  let populated = 0;
  if (s.room_number) populated++;
  if (s.floor) populated++;
  if (s.housekeeping_status) populated++;
  if (s.occupancy_status) populated++;
  if (s.last_cleaned_at) populated++;
  return {
    id: generateId('hotelrunner'),
    externalId: String(s.room_id),
    pmsSource: 'hotelrunner',
    propertyExternalId: String(s.property_id ?? ''),
    roomExternalId: String(s.room_id),
    roomNumber: s.room_number ?? '',
    floor: s.floor ?? '',
    roomTypeExternalId: String(s.room_type_id ?? ''),
    housekeepingStatus: HK_MAP[(s.housekeeping_status ?? '').toLowerCase()] ?? 'dirty',
    occupancyStatus: OCC_MAP[(s.occupancy_status ?? '').toLowerCase()] ?? 'vacant',
    assignedTo: s.assigned_to ?? '',
    notes: s.notes ?? '',
    lastCleanedAt: s.last_cleaned_at ?? '',
    updatedAt: s.updated_at ?? '',
    confidence: calcConfidence(populated, 5),
    rawData: s as Record<string, unknown>,
  };
}

export function parseHousekeeping(rawApiResponse: unknown): CanonicalHousekeeping[] {
  const top = HRHKResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected HK response shape', top.error.flatten()); return [];
  }
  return top.data.data.rooms.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
}
