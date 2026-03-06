import { z } from 'zod';
import { CanonicalFolio, FolioItem, FolioItemType } from '../types/folio.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const OperaItemSchema = z.object({
  transactionCode: z.string().optional(),
  transactionDescription: z.string().optional(),
  amount: z.object({ amount: z.union([z.string(), z.number()]).optional(), currencyCode: z.string().optional() }).optional(),
  taxAmount: z.object({ amount: z.union([z.string(), z.number()]).optional() }).optional(),
  transactionDate: z.string().optional(),
  transactionType: z.string().optional(),
}).passthrough();

const OperaFolioSchema = z.object({
  folioId: z.string(),
  reservationId: z.string().optional(),
  hotelId: z.string().optional(),
  profileId: z.string().optional(),
  folioStatus: z.string().optional(),
  currency: z.string().optional(),
  transactionList: z.array(z.unknown()).optional(),
  openDate: z.string().optional(),
  closeDate: z.string().optional(),
}).passthrough();

const OperaFolioResponseSchema = z.object({ folioDetails: z.array(z.unknown()) }).passthrough();

const TYPE_MAP: Record<string, FolioItemType> = {
  ROOM: 'room_charge', ACCOMMODATION: 'room_charge',
  FOOD: 'food_beverage', SPA: 'spa', TAX: 'tax', FEE: 'fee',
  DISCOUNT: 'discount', PAYMENT: 'payment', REBATE: 'discount',
};

function parseItem(raw: unknown, currency: string): FolioItem | null {
  const r = OperaItemSchema.safeParse(raw);
  if (!r.success) return null;
  const it = r.data;
  return {
    id: it.transactionCode ?? String(Math.random()),
    type: TYPE_MAP[(it.transactionType ?? '').toUpperCase()] ?? 'other',
    description: it.transactionDescription ?? '',
    amount: Number(it.amount?.amount ?? 0),
    currency: it.amount?.currencyCode ?? currency,
    date: it.transactionDate ?? '',
    taxAmount: Number(it.taxAmount?.amount ?? 0),
  };
}

function parseFolio(raw: unknown): CanonicalFolio | null {
  const r = OperaFolioSchema.safeParse(raw);
  if (!r.success) { logger.warn('Opera: failed to parse folio', r.error.flatten()); return null; }
  const f = r.data;
  const currency = f.currency ?? '';
  const items = (f.transactionList ?? []).flatMap(i => { const x = parseItem(i, currency); return x ? [x] : []; });
  const charges = items.filter(i => i.amount > 0 && i.type !== 'payment').reduce((s, i) => s + i.amount, 0);
  const payments = items.filter(i => i.type === 'payment').reduce((s, i) => s + Math.abs(i.amount), 0);
  let populated = 0;
  if (f.reservationId) populated++;
  if (f.profileId) populated++;
  if (f.folioStatus) populated++;
  if (currency) populated++;
  if (items.length) populated++;
  if (f.openDate) populated++;
  return {
    id: generateId('opera'),
    externalId: f.folioId,
    pmsSource: 'opera',
    reservationExternalId: f.reservationId ?? '',
    propertyExternalId: f.hotelId ?? '',
    guestExternalId: f.profileId ?? '',
    status: f.folioStatus === 'CLOSED' ? 'closed' : f.folioStatus === 'VOID' ? 'void' : 'open',
    currency,
    items,
    totalCharges: charges,
    totalPayments: payments,
    totalTax: items.reduce((s, i) => s + i.taxAmount, 0),
    outstandingBalance: charges - payments,
    createdAt: f.openDate ?? '',
    closedAt: f.closeDate ?? '',
    confidence: calcConfidence(populated, 6),
    rawData: f as Record<string, unknown>,
  };
}

export function parseFolios(rawApiResponse: unknown): CanonicalFolio[] {
  const top = OperaFolioResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
    logger.error('Opera: unexpected folio response shape', top.error.flatten()); return [];
  }
  return top.data.folioDetails.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
}
