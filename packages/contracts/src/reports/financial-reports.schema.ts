import { z } from 'zod';

// ==========================================
// 1. Customer Receivables Ageing
// ==========================================
export const CustomerAgeingBucketSchema = z.object({
  customerId: z.number().int().positive(),
  customerName: z.string(),
  phone: z.string().nullable().optional(),
  creditLimitMinorUnits: z.number().int().default(0),
  totalDueMinorUnits: z.number().int(),
  currentMinorUnits: z.number().int(), // Not overdue yet
  days1to30MinorUnits: z.number().int(),
  days31to60MinorUnits: z.number().int(),
  days61to90MinorUnits: z.number().int(),
  days90PlusMinorUnits: z.number().int(),
  oldestInvoiceDate: z.string().nullable().optional(),
  unpaidInvoicesCount: z.number().int(),
});
export type CustomerAgeingBucket = z.infer<typeof CustomerAgeingBucketSchema>;

export const ReceivablesAgeingReportSchema = z.object({
  storeId: z.number().int().positive(),
  generatedAtUtc: z.string(),
  totalReceivablesMinorUnits: z.number().int(),
  totalCurrentMinorUnits: z.number().int(),
  total1to30MinorUnits: z.number().int(),
  total31to60MinorUnits: z.number().int(),
  total61to90MinorUnits: z.number().int(),
  total90PlusMinorUnits: z.number().int(),
  totalCustomersCount: z.number().int(),
  customers: z.array(CustomerAgeingBucketSchema),
});
export type ReceivablesAgeingReport = z.infer<typeof ReceivablesAgeingReportSchema>;

// ==========================================
// 2. Supplier Payables Ageing
// ==========================================
export const SupplierAgeingBucketSchema = z.object({
  supplierId: z.number().int().positive(),
  supplierName: z.string(),
  phone: z.string().nullable().optional(),
  totalPayableMinorUnits: z.number().int(),
  currentMinorUnits: z.number().int(),
  days1to30MinorUnits: z.number().int(),
  days31to60MinorUnits: z.number().int(),
  days61to90MinorUnits: z.number().int(),
  days90PlusMinorUnits: z.number().int(),
  oldestGrnDate: z.string().nullable().optional(),
  unpaidGrnsCount: z.number().int(),
});
export type SupplierAgeingBucket = z.infer<typeof SupplierAgeingBucketSchema>;

export const PayablesAgeingReportSchema = z.object({
  storeId: z.number().int().positive(),
  generatedAtUtc: z.string(),
  totalPayablesMinorUnits: z.number().int(),
  totalCurrentMinorUnits: z.number().int(),
  total1to30MinorUnits: z.number().int(),
  total31to60MinorUnits: z.number().int(),
  total61to90MinorUnits: z.number().int(),
  total90PlusMinorUnits: z.number().int(),
  totalSuppliersCount: z.number().int(),
  suppliers: z.array(SupplierAgeingBucketSchema),
});
export type PayablesAgeingReport = z.infer<typeof PayablesAgeingReportSchema>;

// ==========================================
// 3. Cheque Register & Clearing Forecast
// ==========================================
export const ChequeItemSchema = z.object({
  id: z.number().int().positive(),
  direction: z.enum(['INWARD_CUSTOMER', 'OUTWARD_SUPPLIER']),
  partyName: z.string(),
  partyId: z.number().int().nullable().optional(),
  amountMinorUnits: z.number().int().positive(),
  bankName: z.string().nullable().optional(),
  chequeNumber: z.string().nullable().optional(),
  chequeDate: z.string(), // YYYY-MM-DD
  status: z.enum(['POSTED', 'CLEARED', 'BOUNCED', 'CANCELLED']),
  sourceReference: z.string().nullable().optional(), // Sale invoice or Payment #
  createdAtUtc: z.string(),
  daysUntilMaturity: z.number().int(), // negative means overdue
  clearedAtUtc: z.string().nullable().optional(),
  clearedBankAccountId: z.number().int().nullable().optional(),
  clearedBankAccountName: z.string().nullable().optional(),
  attachmentPath: z.string().nullable().optional(),
});
export type ChequeItem = z.infer<typeof ChequeItemSchema>;

export const ChequeRegisterReportSchema = z.object({
  storeId: z.number().int().positive(),
  generatedAtUtc: z.string(),
  inwardTotalMinorUnits: z.number().int(),
  inwardPendingMinorUnits: z.number().int(),
  inwardClearedMinorUnits: z.number().int(),
  outwardTotalMinorUnits: z.number().int(),
  outwardPendingMinorUnits: z.number().int(),
  outwardClearedMinorUnits: z.number().int(),
  forecast7DaysNetMinorUnits: z.number().int(),
  forecast30DaysNetMinorUnits: z.number().int(),
  cheques: z.array(ChequeItemSchema),
});
export type ChequeRegisterReport = z.infer<typeof ChequeRegisterReportSchema>;

// ==========================================
// 4. Stock Valuation Report
// ==========================================
export const StockValuationItemSchema = z.object({
  variantId: z.number().int().positive(),
  productId: z.number().int().positive(),
  productName: z.string(),
  sku: z.string(),
  categoryName: z.string().nullable().optional(),
  unitCode: z.string(),
  quantityOnHand: z.number(),
  wholesaleCostPriceMinorUnits: z.number().int(),
  retailPriceMinorUnits: z.number().int(),
  totalCostValuationMinorUnits: z.number().int(),
  totalRetailValuationMinorUnits: z.number().int(),
  potentialGrossProfitMinorUnits: z.number().int(),
});
export type StockValuationItem = z.infer<typeof StockValuationItemSchema>;

export const StockValuationCategorySummarySchema = z.object({
  categoryId: z.number().int().nullable().optional(),
  categoryName: z.string(),
  itemCount: z.number().int(),
  totalQuantity: z.number(),
  totalValuationMinorUnits: z.number().int(),
});
export type StockValuationCategorySummary = z.infer<typeof StockValuationCategorySummarySchema>;

export const StockValuationReportSchema = z.object({
  storeId: z.number().int().positive(),
  generatedAtUtc: z.string(),
  totalStockQuantity: z.number(),
  totalCostValuationMinorUnits: z.number().int(),
  totalRetailValuationMinorUnits: z.number().int(),
  totalPotentialProfitMinorUnits: z.number().int(),
  categoryBreakdown: z.array(StockValuationCategorySummarySchema),
  items: z.array(StockValuationItemSchema),
});
export type StockValuationReport = z.infer<typeof StockValuationReportSchema>;

// ==========================================
// 5. Stakeholder Statement Report
// ==========================================
export const StakeholderStatementReportSchema = z.object({
  stakeholderId: z.number().int().positive(),
  stakeholderCode: z.string(),
  fullName: z.string(),
  stakeholderType: z.string(),
  ownershipPercent: z.number(),
  profitSharePercent: z.number(),
  shareMode: z.string(),
  totalCapitalInvestedMinorUnits: z.number().int(),
  totalDrawingsMinorUnits: z.number().int(),
  totalProfitDistributedMinorUnits: z.number().int(),
  currentCapitalBalanceMinorUnits: z.number().int(),
  transactions: z.array(
    z.object({
      id: z.number().int().positive(),
      txnNumber: z.string(),
      txnDate: z.string(),
      type: z.string(),
      amountMinorUnits: z.number().int(),
      paymentMethod: z.string(),
      reference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      runningBalanceMinorUnits: z.number().int(),
    }),
  ),
});
export type StakeholderStatementReport = z.infer<typeof StakeholderStatementReportSchema>;
