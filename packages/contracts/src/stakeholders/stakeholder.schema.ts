import { z } from 'zod';

export const StakeholderTypeSchema = z.enum(['OWNER', 'PARTNER', 'INVESTOR', 'SILENT_PARTNER']);
export type StakeholderType = z.infer<typeof StakeholderTypeSchema>;

export const StakeholderStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'EXITED']);
export type StakeholderStatus = z.infer<typeof StakeholderStatusSchema>;

export const ShareModeSchema = z.enum(['FIXED_PERCENT', 'CAPITAL_PROPORTIONAL']);
export type ShareMode = z.infer<typeof ShareModeSchema>;

export const StakeholderTxTypeSchema = z.enum([
  'CAPITAL_INTRODUCED',
  'ADDITIONAL_INVESTMENT',
  'CAPITAL_WITHDRAWAL',
  'PROFIT_DISTRIBUTION',
  'DRAWINGS',
  'LOAN_IN',
  'LOAN_REPAYMENT',
]);
export type StakeholderTxType = z.infer<typeof StakeholderTxTypeSchema>;

export const FiscalPeriodStatusSchema = z.enum(['OPEN', 'CLOSING', 'CLOSED']);
export type FiscalPeriodStatus = z.infer<typeof FiscalPeriodStatusSchema>;

export const DistributionRunStatusSchema = z.enum(['DRAFT', 'APPROVED', 'PAID']);
export type DistributionRunStatus = z.infer<typeof DistributionRunStatusSchema>;

// Stakeholder Entity Schema
export const StakeholderSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  code: z.string().min(1).max(50),
  fullName: z.string().min(1).max(150),
  cnicOrTaxId: z.string().max(50).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().nullable().optional(),
  stakeholderType: StakeholderTypeSchema.default('PARTNER'),
  status: StakeholderStatusSchema.default('ACTIVE'),
  joinedDate: z.string(),
  userId: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  // Joined equity details if available
  currentEquity: z
    .object({
      shareMode: ShareModeSchema,
      ownershipBps: z.number().int().min(0).max(10000),
      profitShareBps: z.number().int().min(0).max(10000),
      lossShareBps: z.number().int().min(0).max(10000),
      effectiveFrom: z.string(),
    })
    .optional(),
  // Computed balances
  capitalBalanceMinorUnits: z.number().int().optional(),
  totalDrawingsMinorUnits: z.number().int().optional(),
  totalDistributionsMinorUnits: z.number().int().optional(),
});
export type Stakeholder = z.infer<typeof StakeholderSchema>;

export const CreateStakeholderInputSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(150),
  cnicOrTaxId: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  stakeholderType: StakeholderTypeSchema.default('PARTNER'),
  joinedDate: z.string().min(1),
  shareMode: ShareModeSchema.default('FIXED_PERCENT'),
  ownershipBps: z.number().int().min(0).max(10000).default(0),
  profitShareBps: z.number().int().min(0).max(10000).default(0),
  lossShareBps: z.number().int().min(0).max(10000).default(0),
  initialCapitalMinorUnits: z.number().int().nonnegative().default(0),
  initialPaymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']).default('BANK_TRANSFER'),
  notes: z.string().optional(),
});
export type CreateStakeholderInput = z.infer<typeof CreateStakeholderInputSchema>;

export const UpdateStakeholderInputSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().min(1).max(150),
  cnicOrTaxId: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  stakeholderType: StakeholderTypeSchema,
  status: StakeholderStatusSchema,
  notes: z.string().optional(),
});
export type UpdateStakeholderInput = z.infer<typeof UpdateStakeholderInputSchema>;

export const UpdateStakeholderEquityInputSchema = z.object({
  stakeholderId: z.number().int().positive(),
  shareMode: ShareModeSchema,
  ownershipBps: z.number().int().min(0).max(10000),
  profitShareBps: z.number().int().min(0).max(10000),
  lossShareBps: z.number().int().min(0).max(10000),
  effectiveFrom: z.string().min(1),
  notes: z.string().optional(),
});
export type UpdateStakeholderEquityInput = z.infer<typeof UpdateStakeholderEquityInputSchema>;

// Stakeholder Transactions (Immutable Capital Ledger)
export const StakeholderTransactionSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  stakeholderId: z.number().int().positive(),
  stakeholderName: z.string().optional(),
  txnNumber: z.string().min(1).max(50),
  type: StakeholderTxTypeSchema,
  amountMinorUnits: z.number().int().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']).default('BANK_TRANSFER'),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  periodId: z.number().int().positive().nullable().optional(),
  txnDate: z.string(),
  createdBy: z.string().min(1).max(50),
  createdAtUtc: z.string(),
});
export type StakeholderTransaction = z.infer<typeof StakeholderTransactionSchema>;

export const CreateStakeholderTxInputSchema = z.object({
  stakeholderId: z.number().int().positive(),
  type: StakeholderTxTypeSchema,
  amountMinorUnits: z.number().int().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']).default('BANK_TRANSFER'),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
  periodId: z.number().int().positive().optional(),
  txnDate: z.string().min(1),
});
export type CreateStakeholderTxInput = z.infer<typeof CreateStakeholderTxInputSchema>;

// Fiscal Period
export const FiscalPeriodSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  periodCode: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  startDate: z.string(),
  endDate: z.string(),
  status: FiscalPeriodStatusSchema.default('OPEN'),
  closedBy: z.string().nullable().optional(),
  closedAtUtc: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});
export type FiscalPeriod = z.infer<typeof FiscalPeriodSchema>;

export const CreateFiscalPeriodInputSchema = z.object({
  label: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});
export type CreateFiscalPeriodInput = z.infer<typeof CreateFiscalPeriodInputSchema>;

export const CloseFiscalPeriodInputSchema = z.object({
  periodId: z.number().int().positive(),
  notes: z.string().optional(),
});
export type CloseFiscalPeriodInput = z.infer<typeof CloseFiscalPeriodInputSchema>;

// Profit Distribution Run & Lines
export const ProfitDistributionLineSchema = z.object({
  id: z.number().int().positive().optional(),
  runId: z.number().int().positive().optional(),
  stakeholderId: z.number().int().positive(),
  stakeholderName: z.string().min(1).max(150),
  shareMode: ShareModeSchema,
  shareBps: z.number().int().min(0).max(10000),
  capitalBalanceMinorUnits: z.number().int(),
  allocatedAmountMinorUnits: z.number().int(),
  paidAmountMinorUnits: z.number().int().default(0),
  status: z.enum(['PENDING', 'PAID']).default('PENDING'),
  payoutTxnId: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string().optional(),
});
export type ProfitDistributionLine = z.infer<typeof ProfitDistributionLineSchema>;

export const ProfitDistributionRunSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  runNumber: z.string().min(1).max(50),
  periodId: z.number().int().positive(),
  periodLabel: z.string().optional(),
  revenueMinorUnits: z.number().int(),
  cogsMinorUnits: z.number().int(),
  grossProfitMinorUnits: z.number().int(),
  operatingExpensesMinorUnits: z.number().int(),
  staffCostMinorUnits: z.number().int(),
  netProfitMinorUnits: z.number().int(),
  distributableProfitMinorUnits: z.number().int(),
  retainedEarningsMinorUnits: z.number().int(),
  status: DistributionRunStatusSchema.default('DRAFT'),
  createdBy: z.string().min(1).max(50),
  approvedBy: z.string().nullable().optional(),
  approvedAtUtc: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
  lines: z.array(ProfitDistributionLineSchema).optional(),
});
export type ProfitDistributionRun = z.infer<typeof ProfitDistributionRunSchema>;

export const CalculateDistributionInputSchema = z.object({
  periodId: z.number().int().positive(),
  retentionPercentBps: z.number().int().min(0).max(10000).default(0), // 0 to 100% retained
});
export type CalculateDistributionInput = z.infer<typeof CalculateDistributionInputSchema>;

export const CreateDistributionRunInputSchema = z.object({
  periodId: z.number().int().positive(),
  retentionPercentBps: z.number().int().min(0).max(10000).default(0),
  notes: z.string().optional(),
});
export type CreateDistributionRunInput = z.infer<typeof CreateDistributionRunInputSchema>;

export const ApproveDistributionRunInputSchema = z.object({
  runId: z.number().int().positive(),
  notes: z.string().optional(),
});
export type ApproveDistributionRunInput = z.infer<typeof ApproveDistributionRunInputSchema>;

export const PayoutDistributionRunInputSchema = z.object({
  runId: z.number().int().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']).default('BANK_TRANSFER'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
export type PayoutDistributionRunInput = z.infer<typeof PayoutDistributionRunInputSchema>;

// Summary / Dashboard Types
export const CompanyPnlSummarySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  grossSalesMinorUnits: z.number().int(),
  salesReturnsMinorUnits: z.number().int(),
  netRevenueMinorUnits: z.number().int(),
  cogsMinorUnits: z.number().int(),
  grossProfitMinorUnits: z.number().int(),
  operatingExpensesMinorUnits: z.number().int(),
  staffCostMinorUnits: z.number().int(),
  netProfitMinorUnits: z.number().int(),
  totalCapitalInvestedMinorUnits: z.number().int(),
  totalDistributionsPaidMinorUnits: z.number().int(),
  totalDrawingsMinorUnits: z.number().int(),
  activePartnersCount: z.number().int(),
});
export type CompanyPnlSummary = z.infer<typeof CompanyPnlSummarySchema>;
