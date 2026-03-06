import { z } from 'zod';
import { CanonicalHousekeeping, HousekeepingStatus, OccupancyStatus } from '../types/housekeeping.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const MewsSpaceSchema = z.object({
  Id: z.string(),
  Number: z.string().optional(),
  Floor: z.string().optional(),
  SpaceTypeId: z.string().optional(),
  ServiceId: z.string().optional(),
  HousekeepingStatus: z.string().optional(),
  OccupancyState: z.string().optional(),
  AssigneeName: z.string().optional(),
  Notes: z.string().optional(),
  LastCleanedUtc: z.string().optional(),
  UpdatedUtc: z.string().optional(),
}).passthrough();

const MewsHousekeepingResponseSchema = z.object({
  spaces: z.array(z.unknown()),
}).passthrough();

const HK_MAP: Record<string, HousekeepingStatus> = {
  Clean: 'clean', Dirty: 'dirty', Inspected: 'inspected',
  OutOfService: 'out_of_service', OutOfOrder: 'out_of_order',
};
const OCC_MAP: Record<string, OccupancyStatus> = {
  Occupied: 'occupied', Vacant: 'vacant', DeparturExpected: 'due_out', ArrivalExpected: 'due_in',
};

function parseSpace(raw: unknown): CanonicalHousekeeping | null {
  const r = MewsSpaceSchema.safeParse(raw);
  if (!r.success) { logger.warn('Mews: failed to parse space', r.error.flatten()); return null; }
  const s = r.data;
  let populated = 0;
  if (s.Number) populated++;
  if (s.Floor) populated++;
  if (s.HousekeepingStatus) populated++;
  if (s.OccupancyState) populated++;
  if (s.LastCleanedUtc) populated++;
  return {
    id: generateId('mews'),
    externalId: s.Id,
    pmsSource: 'mews',
    propertyExternalId: s.ServiceId ?? '',
    roomExternalId: s.Id,
    roomNumber: s.Number ?? '',
    floor: s.Floor ?? '',
    roomTypeExternalId: s.SpaceTypeId ?? '',
    housekeepingStatus: HK_MAP[s.HousekeepingStatus ?? ''] ?? 'dirty',
    occupancyStatus: OCC_MAP[s.OccupancyState ?? ''] ?? 'vacant',
    assignedTo: s.AssigneeName ?? '',
    notes: s.Notes ?? '',
    lastCleanedAt: s.LastCleanedUtc ?? '',
    updatedAt: s.UpdatedUtc ?? '',
    confidence: calcConfidence(populated, 5),
    rawData: s as Record<string, unknown>,
  };
}

export function parseHousekeeping(rawApiResponse: unknown): CanonicalHousekeeping[] {
  const top = MewsHousekeepingResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseSpace(i); return r ? [r] : []; });
    logger.error('Mews: unexpected spaces response shape', top.error.flatten());
    return [];
  }
  return top.data.spaces.flatMap(i => { const r = parseSpace(i); return r ? [r] : []; });
}
