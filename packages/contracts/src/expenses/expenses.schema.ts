import { z } from 'zod';

// ==========================================
// EXPENSE CATEGORIES
// ==========================================

export const ExpenseCategorySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(100),
  isSystem: z.boolean(),
  createdAtUtc: z.string(),
});
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const CreateExpenseCategoryInputSchema = z.object({
  name: z.string().min(2).max(100),
});
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategoryInputSchema>;

// ==========================================
// EXPENSES
// ==========================================

export const PaymentMethodSchema = z.enum([
  'cash_drawer',
  'cash_hand',
  'bank_transfer',
  'cheque',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ExpenseSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  categoryId: z.number().int(),
  categoryName: z.string().optional(),
  title: z.string().min(1).max(255),
  amountMinorUnits: z.number().int().positive(),
  paymentMethod: PaymentMethodSchema,
  shiftId: z.number().int().nullable().optional(),
  voucherNumber: z.string().nullable().optional(),
  paidTo: z.string().nullable().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().optional(),
  createdByUserId: z.number().int().nullable().optional(),
  createdByName: z.string(),
  createdAtUtc: z.string(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const CreateExpenseInputSchema = z.object({
  storeId: z.number().int(),
  categoryId: z.number().int(),
  title: z.string().min(2).max(255),
  amountMinorUnits: z.number().int().positive(),
  paymentMethod: PaymentMethodSchema,
  shiftId: z.number().int().optional(),
  voucherNumber: z.string().max(100).optional(),
  paidTo: z.string().max(150).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  createdByUserId: z.number().int().optional(),
  createdByName: z.string(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;

export const ListExpensesQuerySchema = z.object({
  storeId: z.number().int(),
  categoryId: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.string().optional(),
});
export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;

// ==========================================
// STAFF PAYROLL PROFILES
// ==========================================

export const StaffPayrollProfileSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  userRole: z.string().optional(),
  baseMonthlySalaryMinorUnits: z.number().int().nonnegative(),
  designation: z.string(),
  joiningDate: z.string().nullable().optional(),
  paymentMethodPreference: z.string(),
  bankAccountDetails: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});
export type StaffPayrollProfile = z.infer<typeof StaffPayrollProfileSchema>;

export const UpsertPayrollProfileInputSchema = z.object({
  userId: z.number().int(),
  baseMonthlySalaryMinorUnits: z.number().int().nonnegative(),
  designation: z.string().min(2).max(100).optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethodPreference: z.string().optional(),
  bankAccountDetails: z.string().optional(),
});
export type UpsertPayrollProfileInput = z.infer<typeof UpsertPayrollProfileInputSchema>;

// ==========================================
// SALARY ADVANCES
// ==========================================

export const SalaryAdvanceStatusSchema = z.enum([
  'pending',
  'deducted_in_salary',
  'written_off',
]);
export type SalaryAdvanceStatus = z.infer<typeof SalaryAdvanceStatusSchema>;

export const SalaryAdvanceSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  userId: z.number().int(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  amountMinorUnits: z.number().int().positive(),
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string(),
  shiftId: z.number().int().nullable().optional(),
  reason: z.string().nullable().optional(),
  status: SalaryAdvanceStatusSchema,
  settledInSalaryPaymentId: z.number().int().nullable().optional(),
  createdByUserId: z.number().int().nullable().optional(),
  createdByName: z.string(),
  createdAtUtc: z.string(),
});
export type SalaryAdvance = z.infer<typeof SalaryAdvanceSchema>;

export const CreateSalaryAdvanceInputSchema = z.object({
  storeId: z.number().int(),
  userId: z.number().int(),
  amountMinorUnits: z.number().int().positive(),
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string().default('cash_drawer'),
  shiftId: z.number().int().optional(),
  reason: z.string().optional(),
  createdByUserId: z.number().int().optional(),
  createdByName: z.string(),
});
export type CreateSalaryAdvanceInput = z.infer<typeof CreateSalaryAdvanceInputSchema>;

export const UpdateSalaryAdvanceInputSchema = z.object({
  id: z.number().int(),
  amountMinorUnits: z.number().int().positive().optional(),
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.string().optional(),
  reason: z.string().optional(),
});
export type UpdateSalaryAdvanceInput = z.infer<typeof UpdateSalaryAdvanceInputSchema>;

export const DeleteSalaryAdvanceInputSchema = z.object({
  id: z.number().int(),
});
export type DeleteSalaryAdvanceInput = z.infer<typeof DeleteSalaryAdvanceInputSchema>;

// ==========================================
// SALARY PAYMENTS (MONTHLY PAYROLL)
// ==========================================

export const SalaryPaymentSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  userId: z.number().int(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  payrollMonth: z.string().regex(/^\d{4}-\d{2}$/),
  baseSalaryMinorUnits: z.number().int(),
  advancesDeductedMinorUnits: z.number().int(),
  bonusesMinorUnits: z.number().int(),
  deductionsMinorUnits: z.number().int(),
  netPaidMinorUnits: z.number().int(),
  paymentMethod: z.string(),
  shiftId: z.number().int().nullable().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().optional(),
  status: z.enum(['paid', 'pending']),
  createdByUserId: z.number().int().nullable().optional(),
  createdByName: z.string(),
  createdAtUtc: z.string(),
});
export type SalaryPayment = z.infer<typeof SalaryPaymentSchema>;

export const DisburseSalaryInputSchema = z.object({
  storeId: z.number().int(),
  userId: z.number().int(),
  payrollMonth: z.string().regex(/^\d{4}-\d{2}$/),
  baseSalaryMinorUnits: z.number().int().nonnegative(),
  advancesDeductedMinorUnits: z.number().int().nonnegative().default(0),
  bonusesMinorUnits: z.number().int().nonnegative().default(0),
  deductionsMinorUnits: z.number().int().nonnegative().default(0),
  netPaidMinorUnits: z.number().int().nonnegative(),
  paymentMethod: z.string().default('cash_hand'),
  shiftId: z.number().int().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  createdByUserId: z.number().int().optional(),
  createdByName: z.string(),
});
export type DisburseSalaryInput = z.infer<typeof DisburseSalaryInputSchema>;

// ==========================================
// MONTHLY PAYROLL SHEET SUMMARY
// ==========================================

export const StaffPayrollSheetRowSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: z.string(),
  designation: z.string(),
  baseMonthlySalaryMinorUnits: z.number().int(),
  pendingAdvancesMinorUnits: z.number().int(),
  currentMonthAdvancesMinorUnits: z.number().int().default(0),
  carriedOverAdvanceMinorUnits: z.number().int().default(0),
  overAdvancedMinorUnits: z.number().int().default(0),
  advancesCount: z.number().int().default(0),
  status: z.enum(['paid', 'unpaid', 'over_advanced']),
  paidRecord: SalaryPaymentSchema.nullable().optional(),
});
export type StaffPayrollSheetRow = z.infer<typeof StaffPayrollSheetRowSchema>;

export const MonthlyPayrollSheetResponseSchema = z.object({
  payrollMonth: z.string(),
  rows: z.array(StaffPayrollSheetRowSchema),
  totalBaseSalaryMinorUnits: z.number().int(),
  totalAdvancesPendingMinorUnits: z.number().int(),
  totalCurrentMonthAdvancesMinorUnits: z.number().int().default(0),
  totalCarriedOverAdvanceMinorUnits: z.number().int().default(0),
  totalNetPaidMinorUnits: z.number().int(),
});
export type MonthlyPayrollSheetResponse = z.infer<typeof MonthlyPayrollSheetResponseSchema>;

// ==========================================
// EMPLOYEE MONTHLY STATEMENT & LEDGER
// ==========================================

export const EmployeeStatementEntrySchema = z.object({
  id: z.number().int(),
  type: z.enum(['advance', 'bonus', 'deduction', 'salary_payment']),
  amountMinorUnits: z.number().int(),
  date: z.string(),
  createdAtUtc: z.string(),
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string(),
  createdByName: z.string(),
});
export type EmployeeStatementEntry = z.infer<typeof EmployeeStatementEntrySchema>;

export const GetEmployeeStatementQuerySchema = z.object({
  storeId: z.number().int(),
  userId: z.number().int(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type GetEmployeeStatementQuery = z.infer<typeof GetEmployeeStatementQuerySchema>;

export const EmployeeMonthlyStatementResponseSchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  username: z.string(),
  role: z.string(),
  designation: z.string(),
  month: z.string(),
  baseSalaryMinorUnits: z.number().int(),
  totalAdvancesMinorUnits: z.number().int(),
  totalBonusesMinorUnits: z.number().int(),
  totalDeductionsMinorUnits: z.number().int(),
  netPayableMinorUnits: z.number().int(),
  status: z.enum(['paid', 'unpaid', 'over_advanced']),
  carriedOverAdvanceMinorUnits: z.number().int(),
  paidRecord: SalaryPaymentSchema.nullable().optional(),
  entries: z.array(EmployeeStatementEntrySchema),
});
export type EmployeeMonthlyStatementResponse = z.infer<typeof EmployeeMonthlyStatementResponseSchema>;
