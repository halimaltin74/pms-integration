import { z } from 'zod';
import { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from '../types/housekeeping.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const ElectroRoomSchema = z.object({
  id: z.union([z.string(), z.number()]),
  roomNumber: z.string().optional(),
  floor: z.string().optional(),
  roomTypeId: z.union([z.string(), z.number()]).optional(),
  propertyId: z.union([z.string(), z.number()]).optional(),
  housekeepingStatus: z.string().optional(),
  occupancyStatus: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  lastCleanedAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const ElectroHKResponseSchema = z.object({ rooms: z.array(z.unknown()) }).passthrough();

const HK_MAP: Record<string, HousekeepingStatus> = {
  clean: 'clean', dirty: 'dirty', inspected: 'inspected',
  out_of_service: 'out_of_service', out_of_order: 'out_of_order',
};
const OCC_MAP: Record<string, OccupancyStatus> = {
  occupied: 'occupied', vacant: 'vacant', due_out: 'due_out', due_in: 'due_in',
};

function parseRoom(raw: unknown): CanonicalHousekeeping | null {
  const r = ElectroRoomSchema.safeParse(raw);
  if (!r.success) { logger.warn('Electro: failed to parse room HK', r.error.flatten()); return null; }
  const s = r.data;
  let populated = 0;
  if (s.roomNumber) populated++;
  if (s.floor) populated++;
  if (s.housekeepingStatus) populated++;
  if (s.occupancyStatus) populated++;
  if (s.lastCleanedAt) populated++;
  return {
    id: generateId('electro'),
    externalId: String(s.id),
    pmsSource: 'electro',
    propertyExternalId: String(s.propertyId ?? ''),
    roomExternalId: String(s.id),
    roomNumber: s.roomNumber ?? '',
    floor: s.floor ?? '',
    roomTypeExternalId: String(s.roomTypeId ?? ''),
    housekeepingStatus: HK_MAP[(s.housekeepingStatus ?? '').toLowerCase()] ?? 'dirty',
    occupancyStatus: OCC_MAP[(s.occupancyStatus ?? '').toLowerCase()] ?? 'vacant',
    assignedTo: s.assignedTo ?? '',
    notes: s.notes ?? '',
    lastCleanedAt: s.lastCleanedAt ?? '',
    updatedAt: s.updatedAt ?? '',
    confidence: calcConfidence(populated, 5),
    rawData: s as Record<string, unknown>,
  };
}

export function parseHousekeeping(rawApiResponse: unknown): CanonicalHousekeeping[] {
  const top = ElectroHKResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
    logger.error('Electro: unexpected HK response shape', top.error.flatten()); return [];
  }
  return top.data.rooms.flatMap(i => { const r = parseRoom(i); return r ? [r] : []; });
}
