import { z } from 'zod';

export const RecipeItemSchema = z.object({
  id: z.number().optional(),
  recipeVersionId: z.number().optional(),
  inputVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitCode: z.string().min(1).max(20),
  wastagePercent: z.number().int().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
  // Enriched display fields
  inputVariantName: z.string().optional(),
  inputVariantSku: z.string().optional(),
});

export type RecipeItem = z.infer<typeof RecipeItemSchema>;

export const RecipeVersionSchema = z.object({
  id: z.number(),
  recipeId: z.number(),
  versionNumber: z.number().int().positive(),
  isActive: z.number().int().min(0).max(1),
  notes: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  items: z.array(RecipeItemSchema).optional(),
});

export type RecipeVersion = z.infer<typeof RecipeVersionSchema>;

export const RecipeSchema = z.object({
  id: z.number(),
  storeId: z.number(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  outputVariantId: z.number().int().positive(),
  expectedYieldQuantity: z.number().int().positive(),
  outputUnitCode: z.string().min(1).max(20),
  isActive: z.number().int().min(0).max(1),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  // Enriched fields
  outputVariantName: z.string().optional(),
  outputVariantSku: z.string().optional(),
  currentVersion: RecipeVersionSchema.optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const CreateRecipeInputSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  outputVariantId: z.number().int().positive(),
  expectedYieldQuantity: z.number().int().positive().default(1),
  outputUnitCode: z.string().min(1).max(20),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      inputVariantId: z.number().int().positive(),
      quantity: z.number().int().positive(),
      unitCode: z.string().min(1).max(20),
      wastagePercent: z.number().int().min(0).max(100).default(0),
      notes: z.string().optional(),
    }),
  ).min(1, 'At least one recipe ingredient is required'),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

export const CreateRecipeVersionInputSchema = z.object({
  recipeId: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      inputVariantId: z.number().int().positive(),
      quantity: z.number().int().positive(),
      unitCode: z.string().min(1).max(20),
      wastagePercent: z.number().int().min(0).max(100).default(0),
      notes: z.string().optional(),
    }),
  ).min(1, 'At least one recipe ingredient is required'),
});

export type CreateRecipeVersionInput = z.infer<typeof CreateRecipeVersionInputSchema>;
