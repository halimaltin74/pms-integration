import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const HousekeepingStatusSchema = z.enum([
  'clean',
  'dirty',
  'inspected',
  'out_of_service',
  'out_of_order',
]);
export type HousekeepingStatus = z.infer<typeof HousekeepingStatusSchema>;

export const OccupancyStatusSchema = z.enum([
  'occupied',
  'vacant',
  'due_out',    // checking out today
  'due_in',     // arriving today
]);
export type OccupancyStatus = z.infer<typeof OccupancyStatusSchema>;

export const CanonicalHousekeepingSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  propertyExternalId: z.string(),
  roomExternalId: z.string(),
  roomNumber: z.string(),
  floor: z.string(),
  roomTypeExternalId: z.string(),
  housekeepingStatus: HousekeepingStatusSchema,
  occupancyStatus: OccupancyStatusSchema,
  /** Staff member assigned to clean the room */
  assignedTo: z.string(),
  notes: z.string(),
  /** ISO datetime of last cleaning */
  lastCleanedAt: z.string(),
  updatedAt: z.string(),
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalHousekeeping = z.infer<typeof CanonicalHousekeepingSchema>;
