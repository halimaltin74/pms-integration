import { z } from 'zod';
import { CanonicalFolio, FolioItem, FolioItemType } from '../types/folio.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const HRItemSchema = z.object({
  item_id: z.union([z.string(), z.number()]).optional(),
  item_type: z.string().optional(),
  description: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  tax_amount: z.union([z.string(), z.number()]).optional(),
  date: z.string().optional(),
  currency: z.string().optional(),
}).passthrough();

const HRFolioSchema = z.object({
  folio_id: z.union([z.string(), z.number()]),
  reservation_id: z.union([z.string(), z.number()]).optional(),
  property_id: z.union([z.string(), z.number()]).optional(),
  guest_id: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(z.unknown()).optional(),
  created_at: z.string().optional(),
  closed_at: z.string().optional(),
}).passthrough();

const HRFolioResponseSchema = z.object({ data: z.object({ folios: z.array(z.unknown()) }) }).passthrough();

const TYPE_MAP: Record<string, FolioItemType> = {
  room: 'room_charge', accommodation: 'room_charge', food: 'food_beverage',
  spa: 'spa', tax: 'tax', fee: 'fee', discount: 'discount', payment: 'payment',
};

function parseItem(raw: unknown, currency: string): FolioItem | null {
  const r = HRItemSchema.safeParse(raw);
  if (!r.success) return null;
  const it = r.data;
  return {
    id: String(it.item_id ?? Math.random()),
    type: TYPE_MAP[(it.item_type ?? '').toLowerCase()] ?? 'other',
    description: it.description ?? '',
    amount: Number(it.amount ?? 0),
    currency: it.currency ?? currency,
    date: it.date ?? '',
    taxAmount: Number(it.tax_amount ?? 0),
  };
}

function parseFolio(raw: unknown): CanonicalFolio | null {
  const r = HRFolioSchema.safeParse(raw);
  if (!r.success) { logger.warn('HotelRunner: failed to parse folio', r.error.flatten()); return null; }
  const f = r.data;
  const currency = f.currency ?? '';
  const items = (f.items ?? []).flatMap(i => { const x = parseItem(i, currency); return x ? [x] : []; });
  const charges = items.filter(i => i.amount > 0 && i.type !== 'payment').reduce((s, i) => s + i.amount, 0);
  const payments = items.filter(i => i.type === 'payment').reduce((s, i) => s + Math.abs(i.amount), 0);
  let populated = 0;
  if (f.reservation_id) populated++;
  if (f.guest_id) populated++;
  if (f.status) populated++;
  if (currency) populated++;
  if (items.length) populated++;
  if (f.created_at) populated++;
  return {
    id: generateId('hotelrunner'),
    externalId: String(f.folio_id),
    pmsSource: 'hotelrunner',
    reservationExternalId: String(f.reservation_id ?? ''),
    propertyExternalId: String(f.property_id ?? ''),
    guestExternalId: String(f.guest_id ?? ''),
    status: f.status === 'closed' ? 'closed' : f.status === 'void' ? 'void' : 'open',
    currency,
    items,
    totalCharges: charges,
    totalPayments: payments,
    totalTax: items.reduce((s, i) => s + i.taxAmount, 0),
    outstandingBalance: charges - payments,
    createdAt: f.created_at ?? '',
    closedAt: f.closed_at ?? '',
    confidence: calcConfidence(populated, 6),
    rawData: f as Record<string, unknown>,
  };
}

export function parseFolios(rawApiResponse: unknown): CanonicalFolio[] {
  const top = HRFolioResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
    logger.error('HotelRunner: unexpected folio response shape', top.error.flatten()); return [];
  }
  return top.data.data.folios.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
}
