import { z } from 'zod';

export const SalesReturnLineSchema = z.object({
  id: z.number().int().positive().optional(),
  salesReturnId: z.number().int().positive().optional(),
  saleItemId: z.number().int().positive().nullable().optional(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().positive(),
  unitCode: z.string().min(1).max(20).default('pcs'),
  unitPriceMinorUnits: z.number().int().nonnegative(),
  totalPriceMinorUnits: z.number().int().nonnegative(),
  condition: z.enum(['RESTOCK', 'DAMAGED_SCRAP']).default('RESTOCK'),
  targetLocationId: z.number().int().positive(),
  targetLocationName: z.string().optional(),
  reason: z.string().max(100).nullable().optional(),
  createdAtUtc: z.string().optional(),
});

export type SalesReturnLine = z.infer<typeof SalesReturnLineSchema>;

export const SalesReturnSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  returnNumber: z.string().min(1).max(50),
  saleId: z.number().int().positive().nullable().optional(),
  originalInvoiceNumber: z.string().max(50).nullable().optional(),
  customerId: z.number().int().positive().nullable().optional(),
  customerName: z.string().max(150).nullable().optional(),
  customerPhone: z.string().max(50).nullable().optional(),
  returnDateUtc: z.string(),
  reason: z.string().max(100),
  refundMethod: z.enum(['CREDIT_NOTE', 'CASH_REFUND', 'BANK_REFUND', 'NO_REFUND']).default('CREDIT_NOTE'),
  totalAmountMinorUnits: z.number().int().nonnegative(),
  refundAmountMinorUnits: z.number().int().nonnegative(),
  status: z.enum(['COMPLETED', 'CANCELLED']).default('COMPLETED'),
  processedBy: z.string().min(1).max(50),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  lines: z.array(SalesReturnLineSchema).optional(),
});

export type SalesReturn = z.infer<typeof SalesReturnSchema>;

export const PostSalesReturnLineInputSchema = z.object({
  saleItemId: z.number().int().positive().optional(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().positive(),
  unitCode: z.string().min(1).max(20).default('pcs'),
  unitPriceMinorUnits: z.number().int().nonnegative(),
  totalPriceMinorUnits: z.number().int().nonnegative().optional(),
  condition: z.enum(['RESTOCK', 'DAMAGED_SCRAP']).default('RESTOCK'),
  targetLocationId: z.number().int().positive().default(1),
  reason: z.string().max(100).optional(),
});

export type PostSalesReturnLineInput = z.infer<typeof PostSalesReturnLineInputSchema>;

export const PostSalesReturnInputSchema = z.object({
  saleId: z.number().int().positive().optional(),
  originalInvoiceNumber: z.string().max(50).optional(),
  customerId: z.number().int().positive().optional(),
  customerName: z.string().max(150).optional(),
  customerPhone: z.string().max(50).optional(),
  reason: z.string().min(1).max(100),
  refundMethod: z.enum(['CREDIT_NOTE', 'CASH_REFUND', 'BANK_REFUND', 'NO_REFUND']).default('CREDIT_NOTE'),
  totalAmountMinorUnits: z.number().int().nonnegative(),
  refundAmountMinorUnits: z.number().int().nonnegative(),
  processedBy: z.string().min(1).max(50),
  notes: z.string().optional(),
  lines: z.array(PostSalesReturnLineInputSchema).min(1),
});

export type PostSalesReturnInput = z.infer<typeof PostSalesReturnInputSchema>;
