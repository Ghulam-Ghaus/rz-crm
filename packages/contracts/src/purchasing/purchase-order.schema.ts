import { z } from 'zod';

export const PurchaseOrderStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]);

export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>;

export const PurchaseOrderLineSchema = z.object({
  id: z.number().int().positive(),
  purchaseOrderId: z.number().int().positive(),
  productVariantId: z.number().int().positive(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  orderedQuantity: z.number().int().positive(),
  receivedQuantity: z.number().int().nonnegative().default(0),
  unitCode: z.string().min(1).max(20),
  unitCostMinorUnits: z.number().int().nonnegative(),
  totalCostMinorUnits: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
});

export type PurchaseOrderLine = z.infer<typeof PurchaseOrderLineSchema>;

export const PurchaseOrderSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  poNumber: z.string().min(1).max(50),
  supplierId: z.number().int().positive(),
  supplierName: z.string().optional(),
  status: PurchaseOrderStatusSchema,
  orderDateUtc: z.string(),
  expectedDeliveryDateUtc: z.string().nullable().optional(),
  subtotalMinorUnits: z.number().int().nonnegative(),
  taxMinorUnits: z.number().int().nonnegative(),
  totalCostMinorUnits: z.number().int().nonnegative(),
  currencyCode: z.string().length(3).default('PKR'),
  notes: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  lines: z.array(PurchaseOrderLineSchema).optional(),
});

export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export const CreatePurchaseOrderLineInputSchema = z.object({
  productVariantId: z.number().int().positive(),
  orderedQuantity: z.number().int().positive(),
  unitCode: z.string().min(1).max(20),
  unitCostMinorUnits: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export type CreatePurchaseOrderLineInput = z.infer<typeof CreatePurchaseOrderLineInputSchema>;

export const CreatePurchaseOrderInputSchema = z.object({
  storeId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  expectedDeliveryDateUtc: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(CreatePurchaseOrderLineInputSchema).min(1),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderInputSchema>;
