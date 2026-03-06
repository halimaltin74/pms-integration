import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const ReservationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
]);
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

export const CanonicalReservationSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  propertyExternalId: z.string(),
  roomTypeExternalId: z.string(),
  roomExternalId: z.string(),         // physical room, empty string if unknown
  guestExternalId: z.string(),
  confirmationNumber: z.string(),
  status: ReservationStatusSchema,
  checkIn: z.string(),                // YYYY-MM-DD
  checkOut: z.string(),               // YYYY-MM-DD
  nights: z.number().int().nonnegative(),
  adults: z.number().int().nonnegative(),
  children: z.number().int().nonnegative(),
  currency: z.string(),
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  outstandingAmount: z.number(),
  rateExternalId: z.string(),
  source: z.string(),                 // booking channel: "Booking.com", "Direct", etc.
  notes: z.string(),
  specialRequests: z.string(),
  createdAt: z.string(),              // ISO datetime
  updatedAt: z.string(),              // ISO datetime
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalReservation = z.infer<typeof CanonicalReservationSchema>;
