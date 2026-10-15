import { z } from 'zod';

export const CartLineItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPriceMinorUnits: z.number().int().nonnegative(),
  sku: z.string().optional(),
  productName: z.string().optional(),
  priceTier: z.enum(['retail', 'wholesale']).optional().default('retail'),
});

export type CartLineItem = z.infer<typeof CartLineItemSchema>;

export const CheckoutSaleInputSchema = z.object({
  storeId: z.number().int().positive(),
  registerId: z.number().int().positive().optional().nullable(),
  shiftId: z.number().int().positive().optional().nullable(),
  cashierId: z.string().default('cashier-01'),
  customerId: z.number().int().positive().optional().nullable(),
  customerName: z.string().optional().nullable(),
  orderType: z.enum(['retail', 'wholesale']).optional().default('retail'),
  priceTier: z.enum(['retail', 'wholesale']).optional().default('retail'),
  locationId: z.number().int().positive().optional().nullable(),
  items: z.array(CartLineItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'credit']).optional().default('cash'),
  amountTenderedMinorUnits: z.number().int().nonnegative(),
  amountPaidMinorUnits: z.number().int().nonnegative().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  referenceNote: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
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
  priceTier: z.enum(['retail', 'wholesale']).optional(),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

export const SaleReceiptSchema = z.object({
  saleId: z.number().int().positive(),
  invoiceNumber: z.string(),
  storeName: z.string(),
  cashierId: z.string(),
  customerId: z.number().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerCompanyName: z.string().nullable().optional(),
  customerTaxNumber: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  orderType: z.enum(['retail', 'wholesale']).default('retail'),
  priceTier: z.enum(['retail', 'wholesale']).default('retail'),
  locationName: z.string().optional(),
  createdAtUtc: z.string(),
  dueDate: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  paymentMethod: z.string().default('cash'),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).default('paid'),
  referenceNote: z.string().nullable().optional(),
  items: z.array(ReceiptItemSchema),
  subtotalMinorUnits: z.number().int(),
  taxMinorUnits: z.number().int(),
  totalMinorUnits: z.number().int(),
  amountPaidMinorUnits: z.number().int(),
  amountTenderedMinorUnits: z.number().int(),
  changeDueMinorUnits: z.number().int(),
  balanceDueMinorUnits: z.number().int().default(0),
  currencyCode: z.string().default('PKR'),
});

export type SaleReceipt = z.infer<typeof SaleReceiptSchema>;

export const SaleSummarySchema = z.object({
  id: z.number().int().positive(),
  invoiceNumber: z.string(),
  customerName: z.string().nullable().optional(),
  orderType: z.enum(['retail', 'wholesale']).default('retail'),
  priceTier: z.enum(['retail', 'wholesale']).default('retail'),
  paymentMethod: z.string().default('cash'),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).default('paid'),
  totalMinorUnits: z.number().int(),
  amountPaidMinorUnits: z.number().int().default(0),
  balanceDueMinorUnits: z.number().int().default(0),
  currencyCode: z.string(),
  status: z.string(),
  itemCount: z.number().int().nonnegative().optional(),
  createdAtUtc: z.string(),
  dueDate: z.string().nullable().optional(),
});

export type SaleSummary = z.infer<typeof SaleSummarySchema>;

export const RecordSalePaymentInputSchema = z.object({
  saleId: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque']).default('cash'),
  reference: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  actorId: z.string().default('admin'),
});

export type RecordSalePaymentInput = z.infer<typeof RecordSalePaymentInputSchema>;
