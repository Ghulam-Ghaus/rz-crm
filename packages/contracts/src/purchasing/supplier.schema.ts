import { z } from 'zod';

export const SupplierSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  paymentTermsDays: z.number().int().nonnegative().default(0),
  creditLimitMinorUnits: z.number().int().nonnegative().default(0),
  outstandingBalanceMinorUnits: z.number().int().default(0),
  isActive: z.number().int().default(1),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Supplier = z.infer<typeof SupplierSchema>;

export const CreateSupplierInputSchema = z.object({
  storeId: z.number().int().positive(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxNumber: z.string().max(50).optional(),
  address: z.string().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  creditLimitMinorUnits: z.number().int().nonnegative().optional(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierInputSchema>;

export const SupplierBalanceSummarySchema = z.object({
  supplierId: z.number().int().positive(),
  supplierCode: z.string(),
  supplierName: z.string(),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  totalPurchasesMinorUnits: z.number().int(),
  totalPaidMinorUnits: z.number().int(),
  outstandingBalanceMinorUnits: z.number().int(),
});

export type SupplierBalanceSummary = z.infer<typeof SupplierBalanceSummarySchema>;

export const SupplierPaymentSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  paymentNumber: z.string(),
  paymentDateUtc: z.string(),
  amountMinorUnits: z.number().int().nonnegative(),
  currencyCode: z.string().default('PKR'),
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  chequeDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paidBy: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type SupplierPayment = z.infer<typeof SupplierPaymentSchema>;

export const CreateSupplierPaymentInputSchema = z.object({
  storeId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_WALLET', 'ADVANCE_ADJUSTMENT', 'OTHER']).default('CASH'),
  paymentDateUtc: z.string().optional(),
  reference: z.string().max(100).optional(),
  bankName: z.string().max(100).optional(),
  chequeDate: z.string().optional(),
  grnId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  paidBy: z.string().optional(),
});

export type CreateSupplierPaymentInput = z.infer<typeof CreateSupplierPaymentInputSchema>;

export const SupplierLedgerEntrySchema = z.object({
  id: z.string(),
  dateUtc: z.string(),
  type: z.enum(['GRN', 'PAYMENT']),
  documentNumber: z.string(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  debitMinorUnits: z.number().int(), // purchase amount (increases liability/payable)
  creditMinorUnits: z.number().int(), // payment amount (decreases liability/payable)
  runningBalanceMinorUnits: z.number().int(),
});

export type SupplierLedgerEntry = z.infer<typeof SupplierLedgerEntrySchema>;

export const SupplierLedgerResponseSchema = z.object({
  supplier: SupplierSchema,
  totalPurchasesMinorUnits: z.number().int(),
  totalPaidMinorUnits: z.number().int(),
  outstandingBalanceMinorUnits: z.number().int(),
  entries: z.array(SupplierLedgerEntrySchema),
});

export type SupplierLedgerResponse = z.infer<typeof SupplierLedgerResponseSchema>;
