import { z } from 'zod';

export const StockBalanceStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock']);
export type StockBalanceStatus = z.infer<typeof StockBalanceStatusSchema>;

export const StockBalanceItemSchema = z.object({
  itemId: z.number().int(),
  itemCode: z.string(),
  itemName: z.string(),
  sku: z.string(),
  barcode: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  locationId: z.number().int().nullable().optional(),
  locationName: z.string().nullable().optional(),
  onHandQuantity: z.number(),
  baseUnitCode: z.string(),
  lowStockThreshold: z.number().default(10),
  status: StockBalanceStatusSchema,
});
export type StockBalanceItem = z.infer<typeof StockBalanceItemSchema>;

export const GetStockBalancesQuerySchema = z.object({
  storeId: z.number().int().default(1),
  locationId: z.number().int().optional(),
  search: z.string().optional(),
  status: StockBalanceStatusSchema.optional(),
});
export type GetStockBalancesQuery = z.infer<typeof GetStockBalancesQuerySchema>;

export const StockMovementLogItemSchema = z.object({
  id: z.number().int(),
  itemId: z.number().int(),
  itemCode: z.string(),
  itemName: z.string(),
  locationName: z.string(),
  movementType: z.string(),
  signedBaseQuantity: z.number(),
  sourceType: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  occurredAtUtc: z.string(),
});
export type StockMovementLogItem = z.infer<typeof StockMovementLogItemSchema>;
