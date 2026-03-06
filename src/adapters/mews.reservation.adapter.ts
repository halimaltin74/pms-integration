import { z } from 'zod';
import { CanonicalReservation, ReservationStatus } from '../types/reservation.canonical';
import { calcConfidence, generateId, logger, toInt } from '../utils';

const MewsReservationSchema = z.object({
  Id: z.string(),
  Number: z.string().optional(),
  ServiceId: z.string().optional(),
  StartUtc: z.string().optional(),
  EndUtc: z.string().optional(),
  AdultCount: z.number().optional(),
  ChildCount: z.number().optional(),
  State: z.string().optional(),
  RateId: z.string().optional(),
  RequestedCategoryId: z.string().optional(),   // room type
  AssignedSpaceId: z.string().optional(),        // physical room
  CustomerId: z.string().optional(),
  Origin: z.string().optional(),
  Notes: z.string().optional(),
  SpecialRequests: z.string().optional(),
  Amount: z.object({
    Currency: z.string().optional(),
    Value: z.number().optional(),
  }).optional(),
  Deposit: z.object({ Value: z.number().optional() }).optional(),
  CreatedUtc: z.string().optional(),
  UpdatedUtc: z.string().optional(),
}).passthrough();

const MewsReservationResponseSchema = z.object({
  reservations: z.array(z.unknown()),
}).passthrough();

const STATUS_MAP: Record<string, ReservationStatus> = {
  Enquired: 'pending',
  Requested: 'pending',
  Optional: 'pending',
  Confirmed: 'confirmed',
  Started: 'checked_in',
  Processed: 'checked_out',
  Cancelled: 'cancelled',
};

function utcToDate(utc: string | undefined): string {
  if (!utc) return '';
  return utc.split('T')[0];
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const d1 = new Date(checkIn).getTime();
  const d2 = new Date(checkOut).getTime();
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

const TOTAL = 13;

function parseReservation(raw: unknown): CanonicalReservation | null {
  const r = MewsReservationSchema.safeParse(raw);
  if (!r.success) {
    logger.warn('Mews: failed to parse reservation', r.error.flatten());
    return null;
  }
  const res = r.data;
  let populated = 0;
  if (res.Number) populated++;
  const checkIn = utcToDate(res.StartUtc); if (checkIn) populated++;
  const checkOut = utcToDate(res.EndUtc); if (checkOut) populated++;
  if (res.AdultCount != null) populated++;
  if (res.ChildCount != null) populated++;
  if (res.State) populated++;
  if (res.RateId) populated++;
  if (res.RequestedCategoryId) populated++;
  if (res.AssignedSpaceId) populated++;
  if (res.CustomerId) populated++;
  if (res.Origin) populated++;
  if (res.Amount?.Value != null) populated++;
  if (res.CreatedUtc) populated++;

  const totalAmount = res.Amount?.Value ?? 0;
  const paid = res.Deposit?.Value ?? 0;

  return {
    id: generateId('mews'),
    externalId: res.Id,
    pmsSource: 'mews',
    propertyExternalId: res.ServiceId ?? '',
    roomTypeExternalId: res.RequestedCategoryId ?? '',
    roomExternalId: res.AssignedSpaceId ?? '',
    guestExternalId: res.CustomerId ?? '',
    confirmationNumber: res.Number ?? '',
    status: STATUS_MAP[res.State ?? ''] ?? 'pending',
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    adults: toInt(res.AdultCount),
    children: toInt(res.ChildCount),
    currency: res.Amount?.Currency ?? '',
    totalAmount,
    paidAmount: paid,
    outstandingAmount: Math.max(0, totalAmount - paid),
    rateExternalId: res.RateId ?? '',
    source: res.Origin ?? '',
    notes: res.Notes ?? '',
    specialRequests: res.SpecialRequests ?? '',
    createdAt: res.CreatedUtc ?? '',
    updatedAt: res.UpdatedUtc ?? '',
    confidence: calcConfidence(populated, TOTAL),
    rawData: res as Record<string, unknown>,
  };
}

export function parseReservations(rawApiResponse: unknown): CanonicalReservation[] {
  const top = MewsReservationResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
    logger.error('Mews: unexpected reservation response shape', top.error.flatten());
    return [];
  }
  return top.data.reservations.flatMap(i => { const r = parseReservation(i); return r ? [r] : []; });
}
