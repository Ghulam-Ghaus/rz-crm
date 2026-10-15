import { z } from 'zod';

export const CartLineItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPriceMinorUnits: z.number().int().nonnegative(),
});

export type CartLineItem = z.infer<typeof CartLineItemSchema>;

export const CheckoutSaleInputSchema = z.object({
  storeId: z.number().int().positive(),
  registerId: z.number().int().positive().optional().nullable(),
  shiftId: z.number().int().positive(),
  cashierId: z.string().default('cashier-01'),
  items: z.array(CartLineItemSchema).min(1),
  amountTenderedMinorUnits: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CheckoutSaleInput = z.input<typeof CheckoutSaleInputSchema>;

export const ReceiptItemSchema = z.object({
  sku: z.string(),
  productName: z.string(),
  quantity: z.number(),
  unitPriceMinorUnits: z.number().int(),
  totalMinorUnits: z.number().int(),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

export const SaleReceiptSchema = z.object({
  saleId: z.number().int().positive(),
  invoiceNumber: z.string(),
  storeName: z.string(),
  cashierId: z.string(),
  createdAtUtc: z.string(),
  items: z.array(ReceiptItemSchema),
  subtotalMinorUnits: z.number().int(),
  taxMinorUnits: z.number().int(),
  totalMinorUnits: z.number().int(),
  amountTenderedMinorUnits: z.number().int(),
  changeDueMinorUnits: z.number().int(),
  currencyCode: z.string().default('PKR'),
});

export type SaleReceipt = z.infer<typeof SaleReceiptSchema>;

export const SaleSummarySchema = z.object({
  id: z.number().int().positive(),
  invoiceNumber: z.string(),
  totalMinorUnits: z.number().int(),
  currencyCode: z.string(),
  status: z.string(),
  itemCount: z.number().int().nonnegative().optional(),
  createdAtUtc: z.string(),
});

export type SaleSummary = z.infer<typeof SaleSummarySchema>;
