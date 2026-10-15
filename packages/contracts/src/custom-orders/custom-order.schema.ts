import { z } from 'zod';
import { CustomerSchema } from './customer.schema.js';

export const CustomOrderStatusSchema = z.enum([
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY',
  'COLLECTED',
  'CANCELLED',
]);

export type CustomOrderStatus = z.infer<typeof CustomOrderStatusSchema>;

export const CustomOrderLineSchema = z.object({
  id: z.number().optional(),
  customOrderId: z.number().optional(),
  productVariantId: z.number().nullable().optional(),
  itemName: z.string().min(1).max(150),
  quantity: z.number().int().positive().default(1),
  unitPriceMinorUnits: z.number().int().nonnegative().default(0),
  totalPriceMinorUnits: z.number().int().nonnegative().default(0),
});

export type CustomOrderLine = z.infer<typeof CustomOrderLineSchema>;

export const CustomOrderPaymentSchema = z.object({
  id: z.number().optional(),
  customOrderId: z.number().optional(),
  paymentType: z.enum(['DEPOSIT', 'BALANCE', 'REFUND']),
  paymentMethod: z.enum(['CASH', 'CARD', 'ONLINE']),
  amountMinorUnits: z.number().int().positive(),
  currencyCode: z.string().min(3).max(3).default('PKR'),
  shiftId: z.number().nullable().optional(),
  cashierId: z.string().nullable().optional(),
  referenceNotes: z.string().nullable().optional(),
  createdAtUtc: z.string().optional(),
});

export type CustomOrderPayment = z.infer<typeof CustomOrderPaymentSchema>;

export const CustomOrderSchema = z.object({
  id: z.number(),
  storeId: z.number(),
  orderNumber: z.string().min(1).max(50),
  customerId: z.number(),
  dueDateUtc: z.string(),
  eventDateUtc: z.string().nullable().optional(),
  status: CustomOrderStatusSchema,
  totalAmountMinorUnits: z.number().int().nonnegative(),
  depositAmountMinorUnits: z.number().int().nonnegative(),
  balanceAmountMinorUnits: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3).default('PKR'),
  cakeFlavor: z.string().nullable().optional(),
  cakeSize: z.string().nullable().optional(),
  cakeMessage: z.string().nullable().optional(),
  decorationNotes: z.string().nullable().optional(),
  allergensNotes: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  // Enriched fields
  customer: CustomerSchema.optional(),
  lines: z.array(CustomOrderLineSchema).optional(),
  payments: z.array(CustomOrderPaymentSchema).optional(),
});

export type CustomOrder = z.infer<typeof CustomOrderSchema>;

export const CreateCustomOrderInputSchema = z.object({
  storeId: z.number().int().positive().optional(),
  customerId: z.number().int().positive(),
  dueDateUtc: z.string(),
  eventDateUtc: z.string().optional(),
  totalAmountMinorUnits: z.number().int().positive(),
  depositAmountMinorUnits: z.number().int().nonnegative().default(0),
  depositPaymentMethod: z.enum(['CASH', 'CARD', 'ONLINE']).optional(),
  shiftId: z.number().int().positive().optional(),
  cashierId: z.string().optional(),
  cakeFlavor: z.string().optional(),
  cakeSize: z.string().optional(),
  cakeMessage: z.string().optional(),
  decorationNotes: z.string().optional(),
  allergensNotes: z.string().optional(),
  lines: z.array(
    z.object({
      productVariantId: z.number().int().positive().optional(),
      itemName: z.string().min(1).max(150),
      quantity: z.number().int().positive().default(1),
      unitPriceMinorUnits: z.number().int().nonnegative(),
    })
  ).optional(),
});

export type CreateCustomOrderInput = z.infer<typeof CreateCustomOrderInputSchema>;

export const UpdateCustomOrderStatusInputSchema = z.object({
  orderId: z.number().int().positive(),
  status: CustomOrderStatusSchema,
});

export type UpdateCustomOrderStatusInput = z.infer<typeof UpdateCustomOrderStatusInputSchema>;

export const AddCustomOrderPaymentInputSchema = z.object({
  orderId: z.number().int().positive(),
  paymentType: z.enum(['DEPOSIT', 'BALANCE', 'REFUND']),
  paymentMethod: z.enum(['CASH', 'CARD', 'ONLINE']),
  amountMinorUnits: z.number().int().positive(),
  shiftId: z.number().int().positive().optional(),
  cashierId: z.string().optional(),
  referenceNotes: z.string().optional(),
});

export type AddCustomOrderPaymentInput = z.infer<typeof AddCustomOrderPaymentInputSchema>;
