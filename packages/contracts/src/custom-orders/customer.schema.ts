import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.number(),
  storeId: z.number(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Customer = z.infer<typeof CustomerSchema>;

export const CreateCustomerInputSchema = z.object({
  storeId: z.number().int().positive().optional(),
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;
