import { z } from 'zod';

export const PurchaseReturnLineSchema = z.object({
  id: z.number().int().positive().optional(),
  purchaseReturnId: z.number().int().positive().optional(),
  grnLineId: z.number().int().positive().nullable().optional(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().positive(),
  unitCode: z.string().min(1).max(20).default('pcs'),
  unitCostMinorUnits: z.number().int().nonnegative(),
  totalCostMinorUnits: z.number().int().nonnegative(),
  sourceLocationId: z.number().int().positive(),
  sourceLocationName: z.string().optional(),
  lotNumber: z.string().max(50).nullable().optional(),
  reason: z.string().max(100).nullable().optional(),
  createdAtUtc: z.string().optional(),
});

export type PurchaseReturnLine = z.infer<typeof PurchaseReturnLineSchema>;

export const PurchaseReturnSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  returnNumber: z.string().min(1).max(50),
  supplierId: z.number().int().positive(),
  supplierName: z.string().max(150).optional(),
  goodsReceiptId: z.number().int().positive().nullable().optional(),
  supplierInvoiceRef: z.string().max(100).nullable().optional(),
  returnDateUtc: z.string(),
  reason: z.string().max(100),
  settlementMethod: z.enum(['DEBIT_NOTE', 'CASH_REFUND', 'BANK_REFUND']).default('DEBIT_NOTE'),
  totalAmountMinorUnits: z.number().int().nonnegative(),
  refundAmountMinorUnits: z.number().int().nonnegative(),
  status: z.enum(['COMPLETED', 'CANCELLED']).default('COMPLETED'),
  processedBy: z.string().min(1).max(50),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  lines: z.array(PurchaseReturnLineSchema).optional(),
});

export type PurchaseReturn = z.infer<typeof PurchaseReturnSchema>;

export const PostPurchaseReturnLineInputSchema = z.object({
  grnLineId: z.number().int().positive().optional(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().positive(),
  unitCode: z.string().min(1).max(20).default('pcs'),
  unitCostMinorUnits: z.number().int().nonnegative(),
  totalCostMinorUnits: z.number().int().nonnegative().optional(),
  sourceLocationId: z.number().int().positive().default(1),
  lotNumber: z.string().max(50).optional(),
  reason: z.string().max(100).optional(),
});

export type PostPurchaseReturnLineInput = z.infer<typeof PostPurchaseReturnLineInputSchema>;

export const PostPurchaseReturnInputSchema = z.object({
  supplierId: z.number().int().positive(),
  goodsReceiptId: z.number().int().positive().optional(),
  supplierInvoiceRef: z.string().max(100).optional(),
  reason: z.string().min(1).max(100),
  settlementMethod: z.enum(['DEBIT_NOTE', 'CASH_REFUND', 'BANK_REFUND']).default('DEBIT_NOTE'),
  totalAmountMinorUnits: z.number().int().nonnegative(),
  refundAmountMinorUnits: z.number().int().nonnegative(),
  processedBy: z.string().min(1).max(50),
  notes: z.string().optional(),
  lines: z.array(PostPurchaseReturnLineInputSchema).min(1),
});

export type PostPurchaseReturnInput = z.infer<typeof PostPurchaseReturnInputSchema>;
