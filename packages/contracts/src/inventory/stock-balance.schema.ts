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
  costMinorUnits: z.number().int().optional().default(0),
  priceMinorUnits: z.number().int().optional().default(0),
  wholesalePriceMinorUnits: z.number().int().optional().default(0),
  valuationCostMinorUnits: z.number().int().optional().default(0),
  valuationRetailMinorUnits: z.number().int().optional().default(0),
  status: StockBalanceStatusSchema,
});
export type StockBalanceItem = z.infer<typeof StockBalanceItemSchema>;

export const StockLocationItemSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  code: z.string(),
  name: z.string(),
  locationType: z.string(),
  isActive: z.boolean(),
});
export type StockLocationItem = z.infer<typeof StockLocationItemSchema>;

export const TransferStockInputSchema = z.object({
  storeId: z.number().int().default(1),
  itemId: z.number().int().positive(),
  sourceLocationId: z.number().int().positive(),
  destinationLocationId: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
  actorId: z.string().optional(),
});
export type TransferStockInput = z.infer<typeof TransferStockInputSchema>;

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
