import { z } from 'zod';
import { PMSSourceSchema } from './canonical';

export const FolioStatusSchema = z.enum(['open', 'closed', 'void']);
export type FolioStatus = z.infer<typeof FolioStatusSchema>;

export const FolioItemTypeSchema = z.enum([
  'room_charge',
  'food_beverage',
  'spa',
  'tax',
  'fee',
  'discount',
  'payment',
  'other',
]);
export type FolioItemType = z.infer<typeof FolioItemTypeSchema>;

export const FolioItemSchema = z.object({
  id: z.string(),
  type: FolioItemTypeSchema,
  description: z.string(),
  amount: z.number(),     // negative = credit/discount/payment
  currency: z.string(),
  date: z.string(),       // YYYY-MM-DD
  taxAmount: z.number(),
});
export type FolioItem = z.infer<typeof FolioItemSchema>;

export const CanonicalFolioSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  pmsSource: PMSSourceSchema,
  reservationExternalId: z.string(),
  propertyExternalId: z.string(),
  guestExternalId: z.string(),
  status: FolioStatusSchema,
  currency: z.string(),
  items: z.array(FolioItemSchema),
  totalCharges: z.number().nonnegative(),
  totalPayments: z.number().nonnegative(),
  totalTax: z.number().nonnegative(),
  outstandingBalance: z.number(),
  createdAt: z.string(),
  closedAt: z.string(),
  confidence: z.number().min(0).max(1),
  rawData: z.record(z.string(), z.unknown()),
});
export type CanonicalFolio = z.infer<typeof CanonicalFolioSchema>;
