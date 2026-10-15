import { z } from 'zod';

export const OpeningStockRowSchema = z.object({
  itemId: z.number().int().positive(),
  locationId: z.number().int().nonnegative().optional(),
  quantity: z.number().positive(),
  costPerUnitMinorUnits: z.number().int().nonnegative().optional(),
});

export type OpeningStockRow = z.infer<typeof OpeningStockRowSchema>;

export const ConfirmOpeningStockInputSchema = z.object({
  storeId: z.number().int().positive(),
  notes: z.string().optional(),
  rows: z.array(OpeningStockRowSchema).min(1),
  confirmedBy: z.string().optional(),
});

export type ConfirmOpeningStockInput = z.infer<typeof ConfirmOpeningStockInputSchema>;

export const OpeningStockSessionSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  status: z.enum(['draft', 'confirmed']),
  notes: z.string().nullish(),
  confirmedAtUtc: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type OpeningStockSession = z.infer<typeof OpeningStockSessionSchema>;
