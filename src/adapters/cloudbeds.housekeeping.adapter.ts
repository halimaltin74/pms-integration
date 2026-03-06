import { z } from 'zod';
import { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from '../types/housekeeping.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const CBRoomSchema = z.object({
  roomID: z.union([z.string(), z.number()]),
  roomNumber: z.string().optional(),
  roomFloor: z.string().optional(),
  roomTypeID: z.union([z.string(), z.number()]).optional(),
  propertyID: z.union([z.string(), z.number()]).optional(),
  housekeepingStatus: z.string().optional(),
  occupancyStatus: z.string().optional(),
  assignedHousekeeper: z.string().optional(),
  notes: z.string().optional(),
  lastCleaned: z.string().optional(),
  updatedDate: z.string().optional(),
}).passthrough();

const CBHKResponseSchema = z.object({ success: z.boolean(), data: z.array(z.unknown()) }).passthrough();

const HK_MAP: Record<string, HousekeepingStatus> = {
  clean: 'clean', dirty: 'dirty', inspected: 'inspected',
  out_of_service: 'out_of_service', out_of_order: 'out_of_order',
};
const OCC_MAP: Record<string, OccupancyStatus> = {
  occupied: 'occupied', vacant: 'vacant', due_out: 'due_out', due_in: 'due_in',
  checkout: 'due_out', checkin: 'due_in',
};

function parseRoom(raw: unknown): CanonicalHousekeeping | null {
  const r = CBRoomSchema.safeParse(raw);
  if (!r.success) { logger.warn('Cloudbeds: failed to parse room HK', r.error.flatten()); return null; }
  const s = r.data;
  let populated = 0;
  if (s.roomNumber) populated++;
  if (s.roomFloor) populated++;
  if (s.housekeepingStatus) populated++;
  if (s.occupancyStatus) populated++;
  if (s.lastCleaned) populated++;
  return {
    id: generateId('cloudbeds'),
    externalId: String(s.roomID),
    pmsSource: 'cloudbeds',
    propertyExternalId: String(s.propertyID ?? ''),
    roomExternalId: String(s.roomID),
    roomNumber: s.roomNumber ?? '',
    floor: s.roomFloor ?? '',
    roomTypeExternalId: String(s.roomTypeID ?? ''),
    housekeepingStatus: HK_MAP[(s.housekeepingStatus ?? '').toLowerCase()] ?? 'dirty',
    occupancyStatus: OCC_MAP[(s.occupancyStatus ?? '').toLowerCase()] ?? 'vacant',
    assignedTo: s.assignedHousekeeper ?? '',
    notes: s.notes ?? '',
    lastCleanedAt: s.lastCleaned ?? '',
    updatedAt: s.updatedDate ?? '',
    confidence: calcConfidence(populated, 5),
    rawData: s as Record<string, unknown>,
  };
}

export function parseHousekeeping(rawApiResponse: unknown): CanonicalHousekeeping[] {
  const top = CBHKResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected HK response shape', top.error.flatten()); return [];
  }
  return top.data.data.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
}
