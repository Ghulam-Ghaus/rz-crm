import { z } from 'zod';

export const ShiftStatusSchema = z.enum(['open', 'closed']);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

export const ShiftSchema = z.object({
  id: z.number().int().positive(),
  shiftCode: z.string().optional(),
  storeId: z.number().int().positive(),
  registerId: z.number().int().positive().nullish(),
  cashierId: z.string(),
  status: ShiftStatusSchema,
  openedAtUtc: z.string(),
  closedAtUtc: z.string().nullish(),
  openingFloatMinorUnits: z.number().int().nonnegative(),
  expectedCashMinorUnits: z.number().int(),
  closingCountedMinorUnits: z.number().int().nullish(),
  varianceMinorUnits: z.number().int().nullish(),
  notes: z.string().nullish(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Shift = z.infer<typeof ShiftSchema>;

export const OpenShiftInputSchema = z.object({
  storeId: z.number().int().positive(),
  registerId: z.number().int().positive().optional().nullable(),
  cashierId: z.string().default('cashier-01'),
  openingFloatMinorUnits: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

export type OpenShiftInput = z.input<typeof OpenShiftInputSchema>;

export const CloseShiftInputSchema = z.object({
  shiftId: z.number().int().positive(),
  countedCashMinorUnits: z.number().int().nonnegative(),
  notes: z.string().optional().nullable(),
});

export type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;

export const ShiftReportItemSchema = z.object({
  productName: z.string(),
  sku: z.string(),
  quantitySold: z.number().nonnegative(),
  revenueMinorUnits: z.number().int().nonnegative(),
});

export type ShiftReportItem = z.infer<typeof ShiftReportItemSchema>;

export const ShiftReportSchema = z.object({
  shiftId: z.number().int().positive(),
  shiftCode: z.string().optional(),
  storeName: z.string(),
  cashierId: z.string(),
  status: ShiftStatusSchema,
  openedAtUtc: z.string(),
  closedAtUtc: z.string().nullish(),
  openingFloatMinorUnits: z.number().int().nonnegative(),
  totalCashSalesMinorUnits: z.number().int().nonnegative(),
  totalRefundsMinorUnits: z.number().int().nonnegative().default(0),
  totalExpensesFromDrawerMinorUnits: z.number().int().nonnegative().default(0),
  totalPayoutsFromDrawerMinorUnits: z.number().int().nonnegative().default(0),
  expectedCashMinorUnits: z.number().int(),
  closingCountedMinorUnits: z.number().int().nullish(),
  varianceMinorUnits: z.number().int().nullish(),
  totalTransactions: z.number().int().nonnegative(),
  totalUnitsSold: z.number().nonnegative(),
  itemsSold: z.array(ShiftReportItemSchema),
});

export type ShiftReport = z.infer<typeof ShiftReportSchema>;

