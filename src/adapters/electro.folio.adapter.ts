import { z } from 'zod';
import { CanonicalFolio, FolioItem, FolioItemType } from '../types/folio.canonical';
import { calcConfidence, generateId, logger } from '../utils';

const ElectroItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  taxAmount: z.union([z.string(), z.number()]).optional(),
  date: z.string().optional(),
  currency: z.string().optional(),
}).passthrough();

const ElectroFolioSchema = z.object({
  id: z.union([z.string(), z.number()]),
  reservationId: z.union([z.string(), z.number()]).optional(),
  propertyId: z.union([z.string(), z.number()]).optional(),
  guestId: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(z.unknown()).optional(),
  createdAt: z.string().optional(),
  closedAt: z.string().optional(),
}).passthrough();

const ElectroFolioResponseSchema = z.object({ folios: z.array(z.unknown()) }).passthrough();

const TYPE_MAP: Record<string, FolioItemType> = {
  room_charge: 'room_charge', food_beverage: 'food_beverage', spa: 'spa',
  tax: 'tax', fee: 'fee', discount: 'discount', payment: 'payment',
};

function parseItem(raw: unknown, currency: string): FolioItem | null {
  const r = ElectroItemSchema.safeParse(raw);
  if (!r.success) return null;
  const it = r.data;
  return {
    id: String(it.id ?? Math.random()),
    type: TYPE_MAP[(it.type ?? '').toLowerCase()] ?? 'other',
    description: it.description ?? '',
    amount: Number(it.amount ?? 0),
    currency: it.currency ?? currency,
    date: it.date ?? '',
    taxAmount: Number(it.taxAmount ?? 0),
  };
}

function parseFolio(raw: unknown): CanonicalFolio | null {
  const r = ElectroFolioSchema.safeParse(raw);
  if (!r.success) { logger.warn('Electro: failed to parse folio', r.error.flatten()); return null; }
  const f = r.data;
  const currency = f.currency ?? '';
  const items = (f.items ?? []).flatMap(i => { const x = parseItem(i, currency); return x ? [x] : []; });
  const charges = items.filter(i => i.amount > 0 && i.type !== 'payment').reduce((s, i) => s + i.amount, 0);
  const payments = items.filter(i => i.type === 'payment').reduce((s, i) => s + Math.abs(i.amount), 0);
  let populated = 0;
  if (f.reservationId) populated++;
  if (f.guestId) populated++;
  if (f.status) populated++;
  if (currency) populated++;
  if (items.length) populated++;
  if (f.createdAt) populated++;
  return {
    id: generateId('electro'),
    externalId: String(f.id),
    pmsSource: 'electro',
    reservationExternalId: String(f.reservationId ?? ''),
    propertyExternalId: String(f.propertyId ?? ''),
    guestExternalId: String(f.guestId ?? ''),
    status: f.status === 'closed' ? 'closed' : f.status === 'void' ? 'void' : 'open',
    currency,
    items,
    totalCharges: charges,
    totalPayments: payments,
    totalTax: items.reduce((s, i) => s + i.taxAmount, 0),
    outstandingBalance: charges - payments,
    createdAt: f.createdAt ?? '',
    closedAt: f.closedAt ?? '',
    confidence: calcConfidence(populated, 6),
    rawData: f as Record<string, unknown>,
  };
}

export function parseFolios(rawApiResponse: unknown): CanonicalFolio[] {
  const top = ElectroFolioResponseSchema.safeParse(rawApiResponse);
  if (!top.success) {
    if (Array.isArray(rawApiResponse)) return rawApiResponse.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
    logger.error('Electro: unexpected folio response shape', top.error.flatten()); return [];
  }
  return top.data.folios.flatMap(i => { const r = parseFolio(i); return r ? [r] : []; });
}
