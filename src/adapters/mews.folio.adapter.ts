import { z } from 'zod';
import { CanonicalFolio, FolioItem, FolioItemType } from '../types/folio.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const MewsItemSchema = z.object({
  Id: z.string(),
  Type: z.string().optional(),
  Name: z.string().optional(),
  Amount: z.object({ Value: z.number().optional(), Currency: z.string().optional() }).optional(),
  TaxAmount: z.object({ Value: z.number().optional() }).optional(),
  ConsumedUtc: z.string().optional(),
}).passthrough();

const MewsFolioSchema = z.object({
  Id: z.string(),
  Number: z.string().optional(),
  ReservationId: z.string().optional(),
  CustomerId: z.string().optional(),
  ServiceId: z.string().optional(),
  State: z.string().optional(),
  Currency: z.string().optional(),
  Items: z.array(z.unknown()).optional(),
  CreatedUtc: z.string().optional(),
  ClosedUtc: z.string().optional(),
}).passthrough();

const MewsFolioResponseSchema = z.object({
  bills: z.array(z.unknown()),
}).passthrough();

const TYPE_MAP: Record<string, FolioItemType> = {
  ServiceRevenue: 'room_charge',
  ProductRevenue: 'food_beverage',
  Payment: 'payment',
  Rebate: 'discount',
};

function parseItem(raw: unknown, currency: string): FolioItem | null {
  const r = MewsItemSchema.safeParse(raw);
  if (!r.success) return null;
  const it = r.data;
  return {
    id: it.Id,
    type: TYPE_MAP[it.Type ?? ''] ?? 'other',
    description: it.Name ?? '',
    amount: it.Amount?.Value ?? 0,
    currency: it.Amount?.Currency ?? currency,
    date: it.ConsumedUtc ? it.ConsumedUtc.split('T')[0] : '',
    taxAmount: it.TaxAmount?.Value ?? 0,
  };
}

function parseFolio(raw: unknown): CanonicalFolio | null {
  const r = MewsFolioSchema.safeParse(raw);
  if (!r.success) { logger.warn('Mews: failed to parse bill', r.error.flatten()); return null; }
  const f = r.data;
  const currency = f.Currency ?? '';
  const items = (f.Items ?? []).flatMap(i => { const x = parseItem(i, currency); return x ? [x] : []; });
  const charges = items.filter(i => i.amount > 0 && i.type !== 'payment').reduce((s, i) => s + i.amount, 0);
  const payments = items.filter(i => i.type === 'payment').reduce((s, i) => s + Math.abs(i.amount), 0);
  const tax = items.reduce((s, i) => s + i.taxAmount, 0);
  let populated = 0;
  if (f.ReservationId) populated++;
  if (f.CustomerId) populated++;
  if (f.State) populated++;
  if (currency) populated++;
  if (items.length) populated++;
  if (f.CreatedUtc) populated++;
  return {
    id: generateId('mews'),
    externalId: f.Id,
    pmsSource: 'mews',
    reservationExternalId: f.ReservationId ?? '',
    propertyExternalId: f.ServiceId ?? '',
    guestExternalId: f.CustomerId ?? '',
    status: f.State === 'Closed' ? 'closed' : f.State === 'Void' ? 'void' : 'open',
    currency,
    items,
    totalCharges: charges,
    totalPayments: payments,
    totalTax: tax,
    outstandingBalance: charges - payments,
    createdAt: f.CreatedUtc ?? '',
    closedAt: f.ClosedUtc ?? '',
    confidence: calcConfidence(populated, 6),
    rawData: f as Record<string, unknown>,
  };
}

export function parseFolios(rawApiResponse: unknown): CanonicalFolio[] {
  const top = MewsFolioResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
    logger.error('Mews: unexpected bill response shape', top.error.flatten());
    return [];
  }
  return top.data.bills.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
}
