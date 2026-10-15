import { z } from 'zod';

export const GoodsReceiptLineSchema = z.object({
  id: z.number().int().positive(),
  goodsReceiptId: z.number().int().positive(),
  poLineId: z.number().int().positive().nullable().optional(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  receivedQuantity: z.number().int().positive(),
  unitCode: z.string().min(1).max(20),
  unitCostMinorUnits: z.number().int().nonnegative(),
  totalCostMinorUnits: z.number().int().nonnegative(),
  lotNumber: z.string().nullable().optional(),
  expiryDateUtc: z.string().nullable().optional(),
  salePriceMinorUnits: z.number().int().nonnegative().optional(),
  stockLocationId: z.number().int().positive(),
});

export type GoodsReceiptLine = z.infer<typeof GoodsReceiptLineSchema>;

export const GoodsReceiptSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  grnNumber: z.string().min(1).max(50),
  purchaseOrderId: z.number().int().positive().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  supplierId: z.number().int().positive(),
  supplierName: z.string().optional(),
  supplierInvoiceRef: z.string().min(1).max(100),
  receivedDateUtc: z.string(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']),
  totalAmountMinorUnits: z.number().int().nonnegative(),
  paidAmountMinorUnits: z.number().int().nonnegative().optional(),
  balanceDueMinorUnits: z.number().int().nonnegative().optional(),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'UNPAID']).optional(),
  paymentMethod: z.string().optional(),
  currencyCode: z.string().length(3).default('PKR'),
  notes: z.string().nullable().optional(),
  receivedBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  lines: z.array(GoodsReceiptLineSchema).optional(),
});

export type GoodsReceipt = z.infer<typeof GoodsReceiptSchema>;

export const PostGoodsReceiptLineInputSchema = z.object({
  poLineId: z.number().int().positive().optional(),
  productVariantId: z.number().int().positive(),
  receivedQuantity: z.number().int().positive(),
  unitCode: z.string().min(1).max(20),
  unitCostMinorUnits: z.number().int().nonnegative(),
  newSalePriceMinorUnits: z.number().int().positive().optional(),
  lotNumber: z.string().optional(),
  expiryDateUtc: z.string().optional(),
  stockLocationId: z.number().int().positive().optional(),
});

export type PostGoodsReceiptLineInput = z.infer<typeof PostGoodsReceiptLineInputSchema>;

export const PostGoodsReceiptInputSchema = z.object({
  storeId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  purchaseOrderId: z.number().int().positive().optional(),
  supplierInvoiceRef: z.string().min(1).max(100),
  receivedDateUtc: z.string().optional(),
  notes: z.string().optional(),
  receivedBy: z.string().optional(),
  lines: z.array(PostGoodsReceiptLineInputSchema).min(1),
});

export type PostGoodsReceiptInput = z.infer<typeof PostGoodsReceiptInputSchema>;

export const UpdateGoodsReceiptInputSchema = z.object({
  grnId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  supplierInvoiceRef: z.string().min(1).max(100),
  receivedDateUtc: z.string().optional(),
  notes: z.string().optional(),
  receivedBy: z.string().optional(),
  lines: z.array(PostGoodsReceiptLineInputSchema).min(1),
});

export type UpdateGoodsReceiptInput = z.infer<typeof UpdateGoodsReceiptInputSchema>;

