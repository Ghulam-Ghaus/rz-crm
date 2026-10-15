import { z } from 'zod';

export const ProductionRunStatusSchema = z.enum([
  'PLANNED',
  'RELEASED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export type ProductionRunStatus = z.infer<typeof ProductionRunStatusSchema>;

export const ProductionRunItemSchema = z.object({
  id: z.number().optional(),
  productionRunId: z.number().optional(),
  inputVariantId: z.number().int().positive(),
  plannedQuantity: z.number().int().positive(),
  actualQuantity: z.number().int().nonnegative(),
  unitCode: z.string().min(1).max(20),
  unitCostMinorUnits: z.number().int().nonnegative().default(0),
  totalCostMinorUnits: z.number().int().nonnegative().default(0),
  lotId: z.number().nullable().optional(),
  // Enriched fields
  inputVariantName: z.string().optional(),
  inputVariantSku: z.string().optional(),
});

export type ProductionRunItem = z.infer<typeof ProductionRunItemSchema>;

export const ProductionRunSchema = z.object({
  id: z.number(),
  storeId: z.number(),
  runNumber: z.string().min(1).max(50),
  recipeId: z.number(),
  recipeVersionId: z.number(),
  outputVariantId: z.number(),
  status: ProductionRunStatusSchema,
  plannedBatchCount: z.number().int().positive(),
  plannedOutputQuantity: z.number().int().positive(),
  actualOutputQuantity: z.number().int().nullable().optional(),
  outputUnitCode: z.string().min(1).max(20),
  totalCostMinorUnits: z.number().int().default(0),
  currencyCode: z.string().min(3).max(3).default('PKR'),
  plannedDateUtc: z.string(),
  completedAtUtc: z.string().nullable().optional(),
  outputLotNumber: z.string().nullable().optional(),
  outputExpiryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  // Enriched fields
  recipeName: z.string().optional(),
  outputVariantName: z.string().optional(),
  outputVariantSku: z.string().optional(),
  items: z.array(ProductionRunItemSchema).optional(),
});

export type ProductionRun = z.infer<typeof ProductionRunSchema>;

export const CreateProductionRunInputSchema = z.object({
  recipeId: z.number().int().positive(),
  plannedBatchCount: z.number().int().positive().default(1),
  plannedDateUtc: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateProductionRunInput = z.infer<typeof CreateProductionRunInputSchema>;

export const UpdateProductionRunStatusInputSchema = z.object({
  runId: z.number().int().positive(),
  status: z.enum(['RELEASED', 'IN_PROGRESS', 'CANCELLED']),
  notes: z.string().optional(),
});

export type UpdateProductionRunStatusInput = z.infer<typeof UpdateProductionRunStatusInputSchema>;

export const CompleteProductionRunInputSchema = z.object({
  runId: z.number().int().positive(),
  actualOutputQuantity: z.number().int().positive(),
  outputLotNumber: z.string().optional(),
  outputExpiryDate: z.string().optional(), // YYYY-MM-DD
  notes: z.string().optional(),
  actualItemQuantities: z
    .array(
      z.object({
        inputVariantId: z.number().int().positive(),
        actualQuantity: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type CompleteProductionRunInput = z.infer<typeof CompleteProductionRunInputSchema>;
