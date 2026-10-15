import { z } from 'zod';

export const GetProfitLossQuerySchema = z.object({
  storeId: z.number().int().positive(),
  startDateUtc: z.string().optional().nullable(),
  endDateUtc: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  variantId: z.number().int().positive().optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
});

export type GetProfitLossQuery = z.infer<typeof GetProfitLossQuerySchema>;

export const ProfitLossItemBreakdownSchema = z.object({
  variantId: z.number().int().positive(),
  productName: z.string(),
  sku: z.string(),
  categoryName: z.string().nullable().optional(),
  unitsSold: z.number(),
  avgSellPriceMinorUnits: z.number().int(),
  avgCostPriceMinorUnits: z.number().int(),
  totalRevenueMinorUnits: z.number().int(),
  totalCostMinorUnits: z.number().int(),
  grossProfitMinorUnits: z.number().int(),
  marginPercent: z.number(),
});

export type ProfitLossItemBreakdown = z.infer<typeof ProfitLossItemBreakdownSchema>;

export const ProfitLossReportSchema = z.object({
  storeId: z.number().int().positive(),
  startDateUtc: z.string().nullable().optional(),
  endDateUtc: z.string().nullable().optional(),
  totalRevenueMinorUnits: z.number().int(),
  totalCostMinorUnits: z.number().int(),
  grossProfitMinorUnits: z.number().int(),
  profitMarginPercent: z.number(),
  totalUnitsSold: z.number(),
  totalSalesCount: z.number().int().nonnegative(),
  currencyCode: z.string().default('PKR'),
  totalOperatingExpensesMinorUnits: z.number().int().default(0),
  totalPayrollMinorUnits: z.number().int().default(0),
  totalAdvancesMinorUnits: z.number().int().default(0),
  netProfitMinorUnits: z.number().int().default(0),
  netProfitMarginPercent: z.number().default(0),
  items: z.array(ProfitLossItemBreakdownSchema),
});


export type ProfitLossReport = z.infer<typeof ProfitLossReportSchema>;
