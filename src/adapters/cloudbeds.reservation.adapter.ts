import { z } from 'zod';
import { CanonicalReservation, ReservationStatus } from '../types/reservation.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const CloudbedsReservationSchema = z.object({
  reservationID: z.union([z.string(), z.number()]),
  guestID: z.union([z.string(), z.number()]).optional(),
  propertyID: z.union([z.string(), z.number()]).optional(),
  roomTypeID: z.union([z.string(), z.number()]).optional(),
  roomID: z.union([z.string(), z.number()]).optional(),
  ratePlanID: z.union([z.string(), z.number()]).optional(),
  confirmationNum: z.string().optional(),
  status: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  adults: z.union([z.string(), z.number()]).optional(),
  children: z.union([z.string(), z.number()]).optional(),
  grandTotal: z.union([z.string(), z.number()]).optional(),
  balance: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
  createdDate: z.string().optional(),
  modifiedDate: z.string().optional(),
}).passthrough();

const CloudbedsReservationResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
}).passthrough();

const STATUS_MAP: Record<string, ReservationStatus> = {
  confirmed: 'confirmed',
  not_confirmed: 'pending',
  checked_in: 'checked_in',
  checked_out: 'checked_out',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
}

const TOTAL = 12;

function parseReservation(raw: unknown): CanonicalReservation | null {
  const r = CloudbedsReservationSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Cloudbeds: failed to parse reservation', r.error.flatten());
    return null;
  }
  const res = r.data;
  let populated = 0;
  if (res.confirmationNum) populated++;
  const checkIn = res.checkIn ?? ''; if (checkIn) populated++;
  const checkOut = res.checkOut ?? ''; if (checkOut) populated++;
  if (res.adults != null) populated++;
  if (res.children != null) populated++;
  if (res.status) populated++;
  if (res.roomTypeID) populated++;
  if (res.roomID) populated++;
  if (res.guestID) populated++;
  if (res.grandTotal != null) populated++;
  if (res.currency) populated++;
  if (res.source) populated++;

  const total = Number(res.grandTotal ?? 0);
  const balance = Number(res.balance ?? 0);
  const paid = Math.max(0, total - balance);

  return {
    id: generateId('cloudbeds'),
    externalId: String(res.reservationID),
    pmsSource: 'cloudbeds',
    propertyExternalId: String(res.propertyID ?? ''),
    roomTypeExternalId: String(res.roomTypeID ?? ''),
    roomExternalId: String(res.roomID ?? ''),
    guestExternalId: String(res.guestID ?? ''),
    confirmationNumber: res.confirmationNum ?? '',
    status: STATUS_MAP[res.status?.toLowerCase() ?? ''] ?? 'pending',
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    adults: toInt(res.adults),
    children: toInt(res.children),
    currency: res.currency ?? '',
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: balance,
    rateExternalId: String(res.ratePlanID ?? ''),
    source: res.source ?? '',
    notes: res.notes ?? '',
    specialRequests: res.specialRequests ?? '',
    createdAt: res.createdDate ?? '',
    updatedAt: res.modifiedDate ?? '',
    confidence: calcConfidence(populated, TOTAL),
    rawData: res as Record<string, unknown>,
  };
}

export function parseReservations(rawApiResponse: unknown): CanonicalReservation[] {
  const top = CloudbedsReservationResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected reservation response shape', top.error.flatten());
    return [];
  }
  return top.data.data.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
}
