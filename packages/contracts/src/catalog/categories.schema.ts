import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().positive().nullish(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Category = z.infer<typeof CategorySchema>;

export const CreateCategoryInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  parentId: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
