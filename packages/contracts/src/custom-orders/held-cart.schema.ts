import { z } from 'zod';

export const HeldCartSchema = z.object({
  id: z.number(),
  storeId: z.number(),
  cartCode: z.string().min(1).max(50),
  cashierId: z.string().nullable().optional(),
  customerNameOrPhone: z.string().nullable().optional(),
  cartJson: z.string(),
  itemCount: z.number().int().nonnegative(),
  subtotalMinorUnits: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
});

export type HeldCart = z.infer<typeof HeldCartSchema>;

export const CreateHeldCartInputSchema = z.object({
  storeId: z.number().int().positive().optional(),
  cashierId: z.string().optional(),
  customerNameOrPhone: z.string().optional(),
  cartJson: z.string().min(2),
  itemCount: z.number().int().positive(),
  subtotalMinorUnits: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export type CreateHeldCartInput = z.infer<typeof CreateHeldCartInputSchema>;
