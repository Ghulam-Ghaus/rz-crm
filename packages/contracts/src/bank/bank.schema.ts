import { z } from 'zod';

// ==========================================
// 1. Company Bank Accounts
// ==========================================
export const CompanyBankAccountSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  bankName: z.string().min(1),
  accountTitle: z.string().min(1),
  accountNumber: z.string().min(1),
  iban: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  openingBalanceMinorUnits: z.number().int(),
  currentBalanceMinorUnits: z.number().int(),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});
export type CompanyBankAccount = z.infer<typeof CompanyBankAccountSchema>;

export const CreateBankAccountInputSchema = z.object({
  storeId: z.number().int().positive().default(1),
  bankName: z.string().min(1, 'Bank name is required'),
  accountTitle: z.string().min(1, 'Account title is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  iban: z.string().optional(),
  branchName: z.string().optional(),
  openingBalanceMinorUnits: z.number().int().default(0),
});
export type CreateBankAccountInput = z.infer<typeof CreateBankAccountInputSchema>;

export const UpdateBankAccountInputSchema = z.object({
  id: z.number().int().positive(),
  bankName: z.string().min(1).optional(),
  accountTitle: z.string().min(1).optional(),
  accountNumber: z.string().min(1).optional(),
  iban: z.string().optional(),
  branchName: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBankAccountInput = z.infer<typeof UpdateBankAccountInputSchema>;

// ==========================================
// 2. Bank Transactions & Statements
// ==========================================
export const BankTransactionTypeEnum = z.enum([
  'OPENING',
  'CASH_DEPOSIT',
  'CHEQUE_CLEAR',
  'WITHDRAWAL',
  'TRANSFER',
  'EXPENSE_PAYMENT',
  'SUPPLIER_PAYMENT',
  'STAKEHOLDER_PAYOUT',
  'ADJUSTMENT',
]);
export type BankTransactionType = z.infer<typeof BankTransactionTypeEnum>;

export const BankTransactionSchema = z.object({
  id: z.number().int().positive(),
  accountId: z.number().int().positive(),
  bankName: z.string().optional(),
  accountTitle: z.string().optional(),
  accountNumber: z.string().optional(),
  txnType: BankTransactionTypeEnum,
  direction: z.enum(['INFLOW', 'OUTFLOW']),
  amountMinorUnits: z.number().int().positive(),
  runningBalanceMinorUnits: z.number().int(),
  reference: z.string().nullable().optional(),
  chequeDirection: z.enum(['INWARD', 'OUTWARD']).nullable().optional(),
  chequeId: z.number().int().nullable().optional(),
  attachmentPath: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAtUtc: z.string(),
});
export type BankTransaction = z.infer<typeof BankTransactionSchema>;

export const ListBankTransactionsQuerySchema = z.object({
  storeId: z.number().int().positive().optional().default(1),
  bankAccountId: z.number().int().positive().optional(),
  startDateUtc: z.string().optional(),
  endDateUtc: z.string().optional(),
  limit: z.number().int().positive().optional().default(100),
});
export type ListBankTransactionsQuery = z.infer<typeof ListBankTransactionsQuerySchema>;

// ==========================================
// 3. Cash to Bank Deposit
// ==========================================
export const CashToBankDepositInputSchema = z.object({
  storeId: z.number().int().positive().default(1),
  bankAccountId: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive('Deposit amount must be greater than zero'),
  depositSlipNumber: z.string().optional(),
  notes: z.string().optional(),
  attachmentPath: z.string().optional(),
  depositDateUtc: z.string().optional(),
});
export type CashToBankDepositInput = z.infer<typeof CashToBankDepositInputSchema>;

// ==========================================
// 4. Cheque Clearing
// ==========================================
export const ClearChequeInputSchema = z.object({
  storeId: z.number().int().positive().default(1),
  bankAccountId: z.number().int().positive(),
  chequeDirection: z.enum(['INWARD_CUSTOMER', 'OUTWARD_SUPPLIER']),
  chequeId: z.number().int().positive(),
  chequeNumber: z.string().optional(),
  amountMinorUnits: z.number().int().positive(),
  clearingDateUtc: z.string(),
  notes: z.string().optional(),
  attachmentPath: z.string().optional(),
});
export type ClearChequeInput = z.infer<typeof ClearChequeInputSchema>;

// ==========================================
// 5. Bank KPI Summary
// ==========================================
export const BankSummaryStatsSchema = z.object({
  totalBankBalanceMinorUnits: z.number().int(),
  activeAccountsCount: z.number().int(),
  pendingInwardChequesCount: z.number().int(),
  pendingInwardChequesMinorUnits: z.number().int(),
  pendingOutwardChequesCount: z.number().int(),
  pendingOutwardChequesMinorUnits: z.number().int(),
});
export type BankSummaryStats = z.infer<typeof BankSummaryStatsSchema>;

// ==========================================
// 6. Attachment Contracts
// ==========================================
export const SaveAttachmentInputSchema = z.object({
  folder: z.enum(['cheques', 'slips', 'receipts']),
  filenamePrefix: z.string().min(1),
  base64Data: z.string().min(1), // Base64 or Data URI
});
export type SaveAttachmentInput = z.infer<typeof SaveAttachmentInputSchema>;

export const SaveAttachmentResultSchema = z.object({
  relativePath: z.string(),
  fileSizeBytes: z.number().int(),
  format: z.string(),
});
export type SaveAttachmentResult = z.infer<typeof SaveAttachmentResultSchema>;

export const ReadAttachmentResultSchema = z.object({
  base64Data: z.string(),
  mimeType: z.string(),
});
export type ReadAttachmentResult = z.infer<typeof ReadAttachmentResultSchema>;
