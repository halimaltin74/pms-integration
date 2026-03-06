import { z } from 'zod';
import { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from '../types/housekeeping.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const OperaRoomSchema = z.object({
  roomId: z.string(),
  roomNumber: z.string().optional(),
  floor: z.string().optional(),
  roomType: z.string().optional(),
  hotelId: z.string().optional(),
  housekeepingStatus: z.string().optional(),
  frontDeskStatus: z.string().optional(),
  attendant: z.string().optional(),
  remarks: z.string().optional(),
  lastCleanDate: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
}).passthrough();

const OperaHKResponseSchema = z.object({ rooms: z.object({ room: z.array(z.unknown()) }) }).passthrough();

const HK_MAP: Record<string, HousekeepingStatus> = {
  CLEAN: 'clean', DIRTY: 'dirty', INSPECTED: 'inspected',
  OUTOFSERVICE: 'out_of_service', OUTOFORDER: 'out_of_order',
  'OUT OF SERVICE': 'out_of_service', 'OUT OF ORDER': 'out_of_order',
};
const OCC_MAP: Record<string, OccupancyStatus> = {
  OCCUPIED: 'occupied', VACANT: 'vacant', DUEOUT: 'due_out', DUEIN: 'due_in',
  'DUE OUT': 'due_out', 'DUE IN': 'due_in',
};

function parseRoom(raw: unknown): CanonicalHousekeeping | null {
  const r = OperaRoomSchema.safeParse(raw);
  if (!r.success) { logger.warn('Opera: failed to parse room HK', r.error.flatten()); return null; }
  const s = r.data;
  let populated = 0;
  if (s.roomNumber) populated++;
  if (s.floor) populated++;
  if (s.housekeepingStatus) populated++;
  if (s.frontDeskStatus) populated++;
  if (s.lastCleanDate) populated++;
  return {
    id: generateId('opera'),
    externalId: s.roomId,
    pmsSource: 'opera',
    propertyExternalId: s.hotelId ?? '',
    roomExternalId: s.roomId,
    roomNumber: s.roomNumber ?? '',
    floor: s.floor ?? '',
    roomTypeExternalId: s.roomType ?? '',
    housekeepingStatus: HK_MAP[(s.housekeepingStatus ?? '').toUpperCase()] ?? 'dirty',
    occupancyStatus: OCC_MAP[(s.frontDeskStatus ?? '').toUpperCase()] ?? 'vacant',
    assignedTo: s.attendant ?? '',
    notes: s.remarks ?? '',
    lastCleanedAt: s.lastCleanDate ?? '',
    updatedAt: s.lastModifiedDateTime ?? '',
    confidence: calcConfidence(populated, 5),
    rawData: s as Record<string, unknown>,
  };
}

export function parseHousekeeping(rawApiResponse: unknown): CanonicalHousekeeping[] {
  const top = OperaHKResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
    logger.error('Opera: unexpected HK response shape', top.error.flatten()); return [];
  }
  return top.data.rooms.room.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
}
