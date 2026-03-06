import { z } from 'zod';
import { CanonicalReservation, ReservationStatus } from '../types/reservation.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const HRReservationSchema = z.object({
  reservation_id: z.union([z.string(), z.number()]),
  property_id: z.union([z.string(), z.number()]).optional(),
  room_type_id: z.union([z.string(), z.number()]).optional(),
  room_id: z.union([z.string(), z.number()]).optional(),
  guest_id: z.union([z.string(), z.number()]).optional(),
  rate_plan_id: z.union([z.string(), z.number()]).optional(),
  confirmation_number: z.string().optional(),
  status: z.string().optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  adults: z.union([z.string(), z.number()]).optional(),
  children: z.union([z.string(), z.number()]).optional(),
  total_amount: z.union([z.string(), z.number()]).optional(),
  paid_amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  special_requests: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough();

const HRReservationResponseSchema = z.object({
  data: z.object({ reservations: z.array(z.unknown()) }),
}).passthrough();

const STATUS_MAP: Record<string, ReservationStatus> = {
  confirmed: 'confirmed',
  pending: 'pending',
  checked_in: 'checked_in',
  checked_out: 'checked_out',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

function nights(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

const TOTAL = 11;

function parseReservation(raw: unknown): CanonicalReservation | null {
  const r = HRReservationSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('HotelRunner: failed to parse reservation', r.error.flatten());
    return null;
  }
  const res = r.data;
  let populated = 0;
  if (res.confirmation_number) populated++;
  const checkIn = res.check_in ?? ''; if (checkIn) populated++;
  const checkOut = res.check_out ?? ''; if (checkOut) populated++;
  if (res.adults != null) populated++;
  if (res.children != null) populated++;
  if (res.status) populated++;
  if (res.room_type_id) populated++;
  if (res.guest_id) populated++;
  if (res.total_amount != null) populated++;
  if (res.currency) populated++;
  if (res.source) populated++;

  const total = Number(res.total_amount ?? 0);
  const paid = Number(res.paid_amount ?? 0);

  return {
    id: generateId('hotelrunner'),
    externalId: String(res.reservation_id),
    pmsSource: 'hotelrunner',
    propertyExternalId: String(res.property_id ?? ''),
    roomTypeExternalId: String(res.room_type_id ?? ''),
    roomExternalId: String(res.room_id ?? ''),
    guestExternalId: String(res.guest_id ?? ''),
    confirmationNumber: res.confirmation_number ?? '',
    status: STATUS_MAP[res.status?.toLowerCase() ?? ''] ?? 'pending',
    checkIn,
    checkOut,
    nights: nights(checkIn, checkOut),
    adults: toInt(res.adults),
    children: toInt(res.children),
    currency: res.currency ?? '',
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: Math.max(0, total - paid),
    rateExternalId: String(res.rate_plan_id ?? ''),
    source: res.source ?? '',
    notes: res.notes ?? '',
    specialRequests: res.special_requests ?? '',
    createdAt: res.created_at ?? '',
    updatedAt: res.updated_at ?? '',
    confidence: calcConfidence(populated, TOTAL),
    rawData: res as Record<string, unknown>,
  };
}

export function parseReservations(rawApiResponse: unknown): CanonicalReservation[] {
  const top = HRReservationResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected reservation response shape', top.error.flatten());
    return [];
  }
  return top.data.data.reservations.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
}
