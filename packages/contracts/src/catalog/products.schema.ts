import { z } from 'zod';

export const ProductVariantSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  itemId: z.number().int().positive().nullish(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  priceMinorUnits: z.number().int().nonnegative(),
  costMinorUnits: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  taxClassId: z.number().int().positive().nullish(),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductSchema = z.object({
  id: z.number().int().positive(),
  categoryId: z.number().int().positive().nullish(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().nullish(),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductListItemSchema = z.object({
  id: z.number().int().positive(),
  variantId: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
  categoryName: z.string().nullish(),
  categoryId: z.number().int().positive().nullish(),
  sku: z.string(),
  priceMinorUnits: z.number().int(),
  costMinorUnits: z.number().int().nonnegative().optional().default(0),
  wholesalePriceMinorUnits: z.number().int().nonnegative().optional().default(0),
  reorderPoint: z.number().nonnegative().optional().default(10),
  currencyCode: z.string(),
  barcode: z.string().nullish(),
  baseUnitCode: z.string(),
  isActive: z.boolean(),
});

export type ProductListItem = z.infer<typeof ProductListItemSchema>;

export const CreateProductInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  categoryId: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().min(1).max(50),
  priceMinorUnits: z.number().int().nonnegative(),
  costMinorUnits: z.number().int().nonnegative().optional().default(0),
  wholesalePriceMinorUnits: z.number().int().nonnegative().optional().default(0),
  reorderPoint: z.number().nonnegative().optional().default(10),
  currencyCode: z.string().length(3).optional().default('PKR'),
  baseUnitCode: z.string().optional().default('pcs'),
  barcode: z.string().min(1).max(100).optional(),
});

export type CreateProductInput = z.input<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = z.object({
  id: z.number().int().positive(),
  variantId: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  categoryId: z.number().int().positive().optional().nullable(),
  priceMinorUnits: z.number().int().nonnegative().optional(),
  costMinorUnits: z.number().int().nonnegative().optional(),
  wholesalePriceMinorUnits: z.number().int().nonnegative().optional(),
  reorderPoint: z.number().nonnegative().optional(),
  barcode: z.string().min(1).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

