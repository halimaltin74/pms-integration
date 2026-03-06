import { z } from 'zod';
import { CanonicalReservation, ReservationStatus } from '../types/reservation.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const ElectroReservationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  propertyId: z.union([z.string(), z.number()]).optional(),
  roomTypeId: z.union([z.string(), z.number()]).optional(),
  roomId: z.union([z.string(), z.number()]).optional(),
  guestId: z.union([z.string(), z.number()]).optional(),
  rateId: z.union([z.string(), z.number()]).optional(),
  confirmationNumber: z.string().optional(),
  status: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  adults: z.union([z.string(), z.number()]).optional(),
  children: z.union([z.string(), z.number()]).optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  paidAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const ElectroReservationResponseSchema = z.object({
  reservations: z.array(z.unknown()),
}).passthrough();

const STATUS_MAP: Record<string, ReservationStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  checked_in: 'checked_in',
  checkedin: 'checked_in',
  checked_out: 'checked_out',
  checkedout: 'checked_out',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  no_show: 'no_show',
  noshow: 'no_show',
};

function nights(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

const TOTAL = 11;

function parseReservation(raw: unknown): CanonicalReservation | null {
  const r = ElectroReservationSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Electro: failed to parse reservation', r.error.flatten());
    return null;
  }
  const res = r.data;
  let populated = 0;
  if (res.confirmationNumber) populated++;
  const checkIn = res.checkIn ?? ''; if (checkIn) populated++;
  const checkOut = res.checkOut ?? ''; if (checkOut) populated++;
  if (res.adults != null) populated++;
  if (res.children != null) populated++;
  if (res.status) populated++;
  if (res.roomTypeId) populated++;
  if (res.guestId) populated++;
  if (res.totalAmount != null) populated++;
  if (res.currency) populated++;
  if (res.source) populated++;

  const total = Number(res.totalAmount ?? 0);
  const paid = Number(res.paidAmount ?? 0);

  return {
    id: generateId('electro'),
    externalId: String(res.id),
    pmsSource: 'electro',
    propertyExternalId: String(res.propertyId ?? ''),
    roomTypeExternalId: String(res.roomTypeId ?? ''),
    roomExternalId: String(res.roomId ?? ''),
    guestExternalId: String(res.guestId ?? ''),
    confirmationNumber: res.confirmationNumber ?? '',
    status: STATUS_MAP[(res.status ?? '').toLowerCase()] ?? 'pending',
    checkIn,
    checkOut,
    nights: nights(checkIn, checkOut),
    adults: toInt(res.adults),
    children: toInt(res.children),
    currency: res.currency ?? '',
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: Math.max(0, total - paid),
    rateExternalId: String(res.rateId ?? ''),
    source: res.source ?? '',
    notes: res.notes ?? '',
    specialRequests: res.specialRequests ?? '',
    createdAt: res.createdAt ?? '',
    updatedAt: res.updatedAt ?? '',
    confidence: calcConfidence(populated, TOTAL),
    rawData: res as Record<string, unknown>,
  };
}

export function parseReservations(rawApiResponse: unknown): CanonicalReservation[] {
  const top = ElectroReservationResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
    logger.error('Electro: unexpected reservation response shape', top.error.flatten());
    return [];
  }
  return top.data.reservations.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
}
