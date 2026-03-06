import { z } from 'zod';
import { CanonicalReservation, ReservationStatus } from '../types/reservation.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const OperaReservationSchema = z.object({
  reservationId: z.string(),
  hotelId: z.string().optional(),
  confirmationNumber: z.string().optional(),
  reservationStatus: z.string().optional(),
  roomStay: z.object({
    roomType: z.string().optional(),
    roomId: z.string().optional(),
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    ratePlanCode: z.string().optional(),
    guestCounts: z.object({
      adults: z.union([z.string(), z.number()]).optional(),
      children: z.union([z.string(), z.number()]).optional(),
    }).optional(),
  }).optional(),
  guestProfile: z.object({
    profileId: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }).optional(),
  totalAmount: z.object({
    amount: z.union([z.string(), z.number()]).optional(),
    currencyCode: z.string().optional(),
  }).optional(),
  depositAmount: z.object({
    amount: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  bookingChannel: z.string().optional(),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
  creationDate: z.string().optional(),
  lastModifyDateTime: z.string().optional(),
}).passthrough();

const OperaReservationResponseSchema = z.object({
  reservations: z.object({
    reservation: z.array(z.unknown()),
  }),
}).passthrough();

const STATUS_MAP: Record<string, ReservationStatus> = {
  RESERVED: 'confirmed',
  INHOUSE: 'checked_in',
  CHECKEDOUT: 'checked_out',
  CANCELLED: 'cancelled',
  NOSHOW: 'no_show',
  WAITLISTED: 'pending',
};

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

const TOTAL = 11;

function parseReservation(raw: unknown): CanonicalReservation | null {
  const r = OperaReservationSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Opera: failed to parse reservation', r.error.flatten());
    return null;
  }
  const res = r.data;
  const roomStay = res.roomStay ?? {};
  let populated = 0;
  if (res.confirmationNumber) populated++;
  const checkIn = roomStay.checkInDate ?? ''; if (checkIn) populated++;
  const checkOut = roomStay.checkOutDate ?? ''; if (checkOut) populated++;
  if (roomStay.guestCounts?.adults != null) populated++;
  if (res.reservationStatus) populated++;
  if (roomStay.roomType) populated++;
  if (roomStay.roomId) populated++;
  if (res.guestProfile?.profileId) populated++;
  if (res.totalAmount?.amount != null) populated++;
  if (res.totalAmount?.currencyCode) populated++;
  if (res.bookingChannel) populated++;

  const total = Number(res.totalAmount?.amount ?? 0);
  const deposit = Number(res.depositAmount?.amount ?? 0);

  return {
    id: generateId('opera'),
    externalId: res.reservationId,
    pmsSource: 'opera',
    propertyExternalId: res.hotelId ?? '',
    roomTypeExternalId: roomStay.roomType ?? '',
    roomExternalId: roomStay.roomId ?? '',
    guestExternalId: res.guestProfile?.profileId ?? '',
    confirmationNumber: res.confirmationNumber ?? '',
    status: STATUS_MAP[res.reservationStatus?.toUpperCase() ?? ''] ?? 'pending',
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    adults: toInt(roomStay.guestCounts?.adults),
    children: toInt(roomStay.guestCounts?.children),
    currency: res.totalAmount?.currencyCode ?? '',
    totalAmount: total,
    paidAmount: deposit,
    outstandingAmount: Math.max(0, total - deposit),
    rateExternalId: roomStay.ratePlanCode ?? '',
    source: res.bookingChannel ?? '',
    notes: res.notes ?? '',
    specialRequests: res.specialRequests ?? '',
    createdAt: res.creationDate ?? '',
    updatedAt: res.lastModifyDateTime ?? '',
    confidence: calcConfidence(populated, TOTAL),
    rawData: res as Record<string, unknown>,
  };
}

export function parseReservations(rawApiResponse: unknown): CanonicalReservation[] {
  const top = OperaReservationResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
    logger.error('Opera: unexpected reservation response shape', top.error.flatten());
    return [];
  }
  return top.data.reservations.reservation.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
}
