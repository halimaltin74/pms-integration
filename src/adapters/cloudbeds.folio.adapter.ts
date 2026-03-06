import { z } from 'zod';
import { CanonicalFolio, FolioItem, FolioItemType } from '../types/folio.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const CBItemSchema = z.object({
  itemID: z.union([z.string(), z.number()]).optional(),
  itemType: z.string().optional(),
  itemDescription: z.string().optional(),
  itemAmount: z.union([z.string(), z.number()]).optional(),
  itemTax: z.union([z.string(), z.number()]).optional(),
  itemDate: z.string().optional(),
  currency: z.string().optional(),
}).passthrough();

const CBFolioSchema = z.object({
  folioID: z.union([z.string(), z.number()]),
  reservationID: z.union([z.string(), z.number()]).optional(),
  propertyID: z.union([z.string(), z.number()]).optional(),
  guestID: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(z.unknown()).optional(),
  createdDate: z.string().optional(),
  closedDate: z.string().optional(),
}).passthrough();

const CBFolioResponseSchema = z.object({ success: z.boolean(), data: z.array(z.unknown()) }).passthrough();

const TYPE_MAP: Record<string, FolioItemType> = {
  room: 'room_charge', accommodation: 'room_charge',
  food: 'food_beverage', beverage: 'food_beverage',
  spa: 'spa', tax: 'tax', fee: 'fee',
  discount: 'discount', payment: 'payment',
};

function parseItem(raw: unknown, currency: string): FolioItem | null {
  const r = CBItemSchema.safeParse(raw);
  if (!r.success) return null;
  const it = r.data;
  return {
    id: String(it.itemID ?? Math.random()),
    type: TYPE_MAP[(it.itemType ?? '').toLowerCase()] ?? 'other',
    description: it.itemDescription ?? '',
    amount: Number(it.itemAmount ?? 0),
    currency: it.currency ?? currency,
    date: it.itemDate ?? '',
    taxAmount: Number(it.itemTax ?? 0),
  };
}

function parseFolio(raw: unknown): CanonicalFolio | null {
  const r = CBFolioSchema.safeParse(raw);
  if (!r.success) { logger.warn('Cloudbeds: failed to parse folio', r.error.flatten()); return null; }
  const f = r.data;
  const currency = f.currency ?? '';
  const items = (f.items ?? []).flatMap(i => { const x = parseItem(i, currency); return x ? [x] : []; });
  const charges = items.filter(i => i.amount > 0 && i.type !== 'payment').reduce((s, i) => s + i.amount, 0);
  const payments = items.filter(i => i.type === 'payment').reduce((s, i) => s + Math.abs(i.amount), 0);
  let populated = 0;
  if (f.reservationID) populated++;
  if (f.guestID) populated++;
  if (f.status) populated++;
  if (currency) populated++;
  if (items.length) populated++;
  if (f.createdDate) populated++;
  return {
    id: generateId('cloudbeds'),
    externalId: String(f.folioID),
    pmsSource: 'cloudbeds',
    reservationExternalId: String(f.reservationID ?? ''),
    propertyExternalId: String(f.propertyID ?? ''),
    guestExternalId: String(f.guestID ?? ''),
    status: f.status === 'closed' ? 'closed' : f.status === 'void' ? 'void' : 'open',
    currency,
    items,
    totalCharges: charges,
    totalPayments: payments,
    totalTax: items.reduce((s, i) => s + i.taxAmount, 0),
    outstandingBalance: charges - payments,
    createdAt: f.createdDate ?? '',
    closedAt: f.closedDate ?? '',
    confidence: calcConfidence(populated, 6),
    rawData: f as Record<string, unknown>,
  };
}

export function parseFolios(rawApiResponse: unknown): CanonicalFolio[] {
  const top = CBFolioResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
    logger.error('Cloudbeds: unexpected folio response shape', top.error.flatten()); return [];
  }
  return top.data.data.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
}
