import { z } from 'zod';

export const UnitDimensionSchema = z.enum(['MASS', 'VOLUME', 'COUNT']);
export type UnitDimension = z.infer<typeof UnitDimensionSchema>;

export const UnitSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  dimension: UnitDimensionSchema,
  precision: z.number().int().min(0).max(4),
  isBase: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Unit = z.infer<typeof UnitSchema>;

export const UnitConversionSchema = z.object({
  id: z.number().int().positive(),
  fromUnitCode: z.string().min(1).max(20),
  toUnitCode: z.string().min(1).max(20),
  multiplier: z.number().positive(),
  dimension: z.string(),
  createdAtUtc: z.string(),
});

export type UnitConversion = z.infer<typeof UnitConversionSchema>;

export const CreateUnitInputSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  dimension: UnitDimensionSchema.default('COUNT'),
  precision: z.number().int().min(0).max(4).default(0),
  isBase: z.boolean().default(false),
});

export type CreateUnitInput = z.infer<typeof CreateUnitInputSchema>;

