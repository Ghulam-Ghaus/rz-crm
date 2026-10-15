import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Expense,
  ExpenseCategory,
  SalaryAdvance,
  MonthlyPayrollSheetResponse,
  StaffPayrollSheetRow,
  User,
  EmployeeMonthlyStatementResponse,
} from '@bakery/contracts';

interface ExpensesTabProps {
  storeId?: number;
  currentUserId?: number;
  currentUserName?: string;
  currentUserRole?: string;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  storeId = 1,
  currentUserId,
  currentUserName = 'Admin',
  currentUserRole = 'admin',
}) => {
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'manager';

  // Sub-tabs: 'expenses' (Operating Bills & Repairs), 'payroll' (Staff Payroll & Advances)
  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'payroll'>('expenses');

  // ==========================================
  // STATE: OPERATING EXPENSES
  // ==========================================
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLoading, setExpLoading] = useState<boolean>(true);
  const [expMsg, setExpMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form: New Expense
  const [expCategoryId, setExpCategoryId] = useState<number>(1);
  const [expTitle, setExpTitle] = useState<string>('');
  const [expAmountRs, setExpAmountRs] = useState<string>('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<'cash_drawer' | 'cash_hand' | 'bank_transfer' | 'cheque'>('cash_drawer');
  const [expVoucherNo, setExpVoucherNo] = useState<string>('');
  const [expPaidTo, setExpPaidTo] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [expNotes, setExpNotes] = useState<string>('');
  const [expSubmitting, setExpSubmitting] = useState<boolean>(false);

  // Modal: Quick Add Category & Record Expense
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState<boolean>(false);
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [catSubmitting, setCatSubmitting] = useState<boolean>(false);

  // Filter: Expenses
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTimeframe, setFilterTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // ==========================================
  // STATE: STAFF ADVANCES
  // ==========================================
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [advMsg, setAdvMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modal: Issue Advance
  const [showCreateAdvanceModal, setShowCreateAdvanceModal] = useState<boolean>(false);

  // Form: New Advance
  const [advUserId, setAdvUserId] = useState<number | ''>('');
  const [advAmountRs, setAdvAmountRs] = useState<string>('');
  const [advPaymentMethod, setAdvPaymentMethod] = useState<string>('cash_drawer');
  const [advDate, setAdvDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [advReason, setAdvReason] = useState<string>('');
  const [advSubmitting, setAdvSubmitting] = useState<boolean>(false);

  // Modal: Edit Advance
  const [editAdvanceModal, setEditAdvanceModal] = useState<SalaryAdvance | null>(null);
  const [editAdvAmountRs, setEditAdvAmountRs] = useState<string>('');
  const [editAdvDate, setEditAdvDate] = useState<string>('');
  const [editAdvPaymentMethod, setEditAdvPaymentMethod] = useState<string>('cash_drawer');
  const [editAdvReason, setEditAdvReason] = useState<string>('');
  const [editAdvSubmitting, setEditAdvSubmitting] = useState<boolean>(false);
  const [editAdvMsg, setEditAdvMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ==========================================
  // STATE: MONTHLY PAYROLL
  // ==========================================
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [payrollMonth, setPayrollMonth] = useState<string>(currentMonthStr);
  const [payrollSheet, setPayrollSheet] = useState<MonthlyPayrollSheetResponse | null>(null);
  const [payrollLoading, setPayrollLoading] = useState<boolean>(true);

  // Modal: Edit Base Salary
  const [profileModalStaff, setProfileModalStaff] = useState<User | null>(null);
  const [editSalaryRs, setEditSalaryRs] = useState<string>('');
  const [editDesignation, setEditDesignation] = useState<string>('');
  const [profileSubmitting, setProfileSubmitting] = useState<boolean>(false);

  // Modal: Disburse Salary
  const [disburseModalRow, setDisburseModalRow] = useState<StaffPayrollSheetRow | null>(null);
  const [disburseBonusRs, setDisburseBonusRs] = useState<string>('0');
  const [disburseDeductionsRs, setDisburseDeductionsRs] = useState<string>('0');
  const [disbursePaymentMethod, setDisbursePaymentMethod] = useState<string>('cash_hand');
  const [disburseNotes, setDisburseNotes] = useState<string>('');
  const [disburseSubmitting, setDisburseSubmitting] = useState<boolean>(false);

  // Modal: View / Print Pay Slip
  const [paySlipRow, setPaySlipRow] = useState<StaffPayrollSheetRow | null>(null);

  // Modal: Employee Monthly Statement & Breakdown
  const [statementUserId, setStatementUserId] = useState<number | null>(null);
  const [statementMonth, setStatementMonth] = useState<string>(currentMonthStr);
  const [statementData, setStatementData] = useState<EmployeeMonthlyStatementResponse | null>(null);
  const [statementLoading, setStatementLoading] = useState<boolean>(false);

  // ==========================================
  // DATA LOADERS
  // ==========================================

  const loadCategories = useCallback(async () => {
    try {
      const res = await window.bakery.expenses.listCategories();
      if (res.success && res.data) {
        setCategories(res.data);
        if (res.data.length > 0 && !expCategoryId) {
          setExpCategoryId(res.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load expense categories:', e);
    }
  }, [expCategoryId]);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;
      const now = new Date();

      if (filterTimeframe === 'today') {
        startDate = now.toISOString().slice(0, 10);
        endDate = startDate;
      } else if (filterTimeframe === 'week') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        startDate = d.toISOString().slice(0, 10);
      } else if (filterTimeframe === 'month') {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      }

      const catId = filterCategory !== 'all' ? parseInt(filterCategory, 10) : undefined;

      const res = await window.bakery.expenses.list({
        storeId,
        categoryId: catId,
        startDate,
        endDate,
      });

      if (res.success && res.data) {
        setExpenses(res.data);
      }
    } catch (e) {
      console.error('Failed to load expenses:', e);
    } finally {
      setExpLoading(false);
    }
  }, [storeId, filterCategory, filterTimeframe]);

  const loadStaffUsers = useCallback(async () => {
    try {
      const res = await window.bakery.users.list(storeId);
      if (res.success && res.data) {
        const active = res.data.filter((u) => u.isActive);
        setStaffUsers(active);
        if (active.length > 0 && !advUserId) {
          setAdvUserId(active[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load staff users:', e);
    }
  }, [storeId, advUserId]);

  const loadAdvances = useCallback(async () => {
    try {
      const res = await window.bakery.payroll.listAdvances(storeId);
      if (res.success && res.data) {
        setAdvances(res.data);
      }
    } catch (e) {
      console.error('Failed to load advances:', e);
    }
  }, [storeId]);

  const loadPayrollSheet = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const res = await window.bakery.payroll.getMonthlySheet(storeId, payrollMonth);
      if (res.success && res.data) {
        setPayrollSheet(res.data);
      }
    } catch (e) {
      console.error('Failed to load payroll sheet:', e);
    } finally {
      setPayrollLoading(false);
    }
  }, [storeId, payrollMonth]);

  const loadEmployeeStatement = useCallback(async (userId: number, month: string) => {
    setStatementLoading(true);
    try {
      const res = await window.bakery.payroll.getEmployeeStatement({
        storeId,
        userId,
        month,
      });
      if (res.success) {
        setStatementData(res.data);
      } else {
        alert(res.error.message || 'Failed to load employee statement');
      }
    } catch (e) {
      console.error('Failed to load employee statement:', e);
    } finally {
      setStatementLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (statementUserId) {
      loadEmployeeStatement(statementUserId, statementMonth);
    }
  }, [statementUserId, statementMonth, loadEmployeeStatement]);

  const handleOpenStatement = (userId: number) => {
    setStatementUserId(userId);
    setStatementMonth(payrollMonth || currentMonthStr);
  };

  const handleQuickAdvanceForStaff = (userId: number) => {
    setAdvUserId(userId);
    setAdvAmountRs('');
    setAdvReason('');
    setAdvPaymentMethod('cash_drawer');
    setAdvDate(new Date().toISOString().slice(0, 10));
    setShowCreateAdvanceModal(true);
  };

  useEffect(() => {
    loadCategories();
    loadStaffUsers();
  }, [loadCategories, loadStaffUsers]);

  useEffect(() => {
    if (activeSubTab === 'expenses') {
      loadExpenses();
    } else if (activeSubTab === 'payroll') {
      loadPayrollSheet();
      loadAdvances();
    }
  }, [activeSubTab, loadExpenses, loadAdvances, loadPayrollSheet]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setShowAddCatModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==========================================
  // HANDLERS: OPERATING EXPENSES
  // ==========================================

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpMsg(null);

    const amt = parseFloat(expAmountRs);
    if (isNaN(amt) || amt <= 0) {
      setExpMsg({ type: 'err', text: 'Please enter a valid expense amount in PKR' });
      return;
    }
    if (!expTitle.trim()) {
      setExpMsg({ type: 'err', text: 'Please enter an expense title or description' });
      return;
    }

    setExpSubmitting(true);
    try {
      const res = await window.bakery.expenses.create({
        storeId,
        categoryId: expCategoryId,
        title: expTitle.trim(),
        amountMinorUnits: Math.round(amt * 100),
        paymentMethod: expPaymentMethod,
        voucherNumber: expVoucherNo.trim() || undefined,
        paidTo: expPaidTo.trim() || undefined,
        expenseDate: expDate,
        notes: expNotes.trim() || undefined,
        createdByUserId: currentUserId,
        createdByName: currentUserName,
      });

      if (res.success) {
        setExpMsg({ type: 'ok', text: `Expense of Rs. ${amt.toLocaleString()} recorded successfully!` });
        setExpTitle('');
        setExpAmountRs('');
        setExpVoucherNo('');
        setExpPaidTo('');
        setExpNotes('');
        loadExpenses();
        setTimeout(() => {
          setShowCreateExpenseModal(false);
          setExpMsg(null);
        }, 900);
      } else {
        setExpMsg({ type: 'err', text: res.error?.message || 'Failed to record expense' });
      }
    } catch (err: unknown) {
      setExpMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error recording expense' });
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete expense record: "${title}"?`)) return;
    try {
      const res = await window.bakery.expenses.delete(id);
      if (res.success) {
        loadExpenses();
      } else {
        alert(res.error?.message || 'Failed to delete expense');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting expense');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatSubmitting(true);
    try {
      const res = await window.bakery.expenses.createCategory({ name: newCatName.trim() });
      if (res.success) {
        await loadCategories();
        if (res.data?.id) {
          setExpCategoryId(res.data.id);
        }
        setShowAddCatModal(false);
        setNewCatName('');
      } else {
        alert(res.error?.message || 'Failed to add category');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding category');
    } finally {
      setCatSubmitting(false);
    }
  };

  const exportExpensesCsv = () => {
    if (expenses.length === 0) {
      alert('No expense records to export.');
      return;
    }
    const headers = ['ID', 'Date', 'Category', 'Title', 'Amount (PKR)', 'Payment Method', 'Paid To', 'Voucher #', 'Logged By'];
    const rows = expenses.map((e) => [
      e.id,
      e.expenseDate,
      `"${e.categoryName || ''}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      (e.amountMinorUnits / 100).toFixed(2),
      e.paymentMethod,
      `"${e.paidTo || ''}"`,
      `"${e.voucherNumber || ''}"`,
      `"${e.createdByName}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bakery-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // HANDLERS: STAFF ADVANCES
  // ==========================================

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvMsg(null);

    const targetUserId = Number(advUserId || staffUsers[0]?.id);
    if (!targetUserId) {
      setAdvMsg({ type: 'err', text: 'Please select a staff member' });
      return;
    }
    const amt = parseFloat(advAmountRs);
    if (isNaN(amt) || amt <= 0) {
      setAdvMsg({ type: 'err', text: 'Please enter a valid advance amount in PKR' });
      return;
    }

    setAdvSubmitting(true);
    try {
      const res = await window.bakery.payroll.createAdvance({
        storeId,
        userId: targetUserId,
        amountMinorUnits: Math.round(amt * 100),
        advanceDate: advDate,
        paymentMethod: advPaymentMethod,
        reason: advReason.trim() || undefined,
        createdByUserId: currentUserId,
        createdByName: currentUserName,
      });

      if (res.success) {
        setAdvMsg({ type: 'ok', text: `Salary advance of Rs. ${amt.toLocaleString()} recorded successfully!` });
        setAdvAmountRs('');
        setAdvReason('');
        loadAdvances();
        loadPayrollSheet();
        if (statementUserId) {
          loadEmployeeStatement(statementUserId, statementMonth);
        }
        setTimeout(() => {
          setShowCreateAdvanceModal(false);
          setAdvMsg(null);
        }, 900);
      } else {
        setAdvMsg({ type: 'err', text: res.error?.message || 'Failed to record advance' });
      }
    } catch (err: unknown) {
      setAdvMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error recording advance' });
    } finally {
      setAdvSubmitting(false);
    }
  };

  const handleOpenEditAdvance = (a: SalaryAdvance) => {
    setEditAdvanceModal(a);
    setEditAdvAmountRs(String(a.amountMinorUnits / 100));
    setEditAdvDate(a.advanceDate);
    setEditAdvPaymentMethod(a.paymentMethod);
    setEditAdvReason(a.reason || '');
    setEditAdvMsg(null);
  };

  const handleCloseEditAdvance = () => {
    setEditAdvanceModal(null);
    setEditAdvMsg(null);
  };

  const handleSaveEditAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdvanceModal) return;
    setEditAdvMsg(null);

    const amt = parseFloat(editAdvAmountRs);
    if (isNaN(amt) || amt <= 0) {
      setEditAdvMsg({ type: 'err', text: 'Please enter a valid advance amount in PKR' });
      return;
    }

    setEditAdvSubmitting(true);
    try {
      const res = await window.bakery.payroll.updateAdvance({
        id: editAdvanceModal.id,
        amountMinorUnits: Math.round(amt * 100),
        advanceDate: editAdvDate,
        paymentMethod: editAdvPaymentMethod,
        reason: editAdvReason.trim() || undefined,
      });

      if (res.success) {
        setEditAdvMsg({ type: 'ok', text: `Salary advance updated to Rs. ${amt.toLocaleString()}!` });
        setTimeout(() => {
          handleCloseEditAdvance();
          loadAdvances();
          loadPayrollSheet();
          if (statementUserId) {
            loadEmployeeStatement(statementUserId, statementMonth);
          }
        }, 900);
      } else {
        setEditAdvMsg({ type: 'err', text: res.error?.message || 'Failed to update advance' });
      }
    } catch (err: unknown) {
      setEditAdvMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error updating advance' });
    } finally {
      setEditAdvSubmitting(false);
    }
  };

  const handleDeleteAdvance = async (a: SalaryAdvance) => {
    const amt = (a.amountMinorUnits / 100).toLocaleString();
    const confirm = window.confirm(
      `Are you sure you want to cancel / delete the advance of Rs. ${amt} for ${a.displayName || 'this staff member'}?\n\nThis will remove the advance record and revert any cash drawer shift deduction.`
    );
    if (!confirm) return;

    try {
      const res = await window.bakery.payroll.deleteAdvance({ id: a.id });
      if (res.success) {
        loadAdvances();
        loadPayrollSheet();
        if (statementUserId) {
          loadEmployeeStatement(statementUserId, statementMonth);
        }
      } else {
        alert(res.error?.message || 'Failed to delete advance');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting advance');
    }
  };

  // ==========================================
  // HANDLERS: PAYROLL & SALARIES
  // ==========================================

  const handleOpenEditSalary = (user: User, currentBaseRs: number, designation: string) => {
    setProfileModalStaff(user);
    setEditSalaryRs(currentBaseRs > 0 ? String(currentBaseRs) : '');
    setEditDesignation(designation || user.role);
  };

  const handleSaveSalaryProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalStaff) return;

    const salary = parseFloat(editSalaryRs);
    if (isNaN(salary) || salary < 0) {
      alert('Please enter a valid monthly salary amount (or 0)');
      return;
    }

    setProfileSubmitting(true);
    try {
      const res = await window.bakery.payroll.upsertProfile({
        userId: profileModalStaff.id,
        baseMonthlySalaryMinorUnits: Math.round(salary * 100),
        designation: editDesignation.trim() || profileModalStaff.role,
      });

      if (res.success) {
        setProfileModalStaff(null);
        loadPayrollSheet();
      } else {
        alert(res.error?.message || 'Failed to update salary');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleOpenDisburseModal = (row: StaffPayrollSheetRow) => {
    setDisburseModalRow(row);
    setDisburseBonusRs('0');
    setDisburseDeductionsRs('0');
    setDisbursePaymentMethod('cash_hand');
    setDisburseNotes('');
  };

  const calculateDisburseNet = () => {
    if (!disburseModalRow) return 0;
    const base = disburseModalRow.baseMonthlySalaryMinorUnits / 100;
    const adv = disburseModalRow.pendingAdvancesMinorUnits / 100;
    const bonus = parseFloat(disburseBonusRs) || 0;
    const ded = parseFloat(disburseDeductionsRs) || 0;
    return Math.max(0, base - adv + bonus - ded);
  };

  const handleDisburseSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseModalRow) return;

    const bonus = parseFloat(disburseBonusRs) || 0;
    const ded = parseFloat(disburseDeductionsRs) || 0;
    const bonusMinor = Math.round(bonus * 100);
    const dedMinor = Math.round(ded * 100);

    // Maximum advance that can be deducted from this month's salary payout
    const maxDeductibleAdvanceMinor = Math.max(0, disburseModalRow.baseMonthlySalaryMinorUnits + bonusMinor - dedMinor);
    const actualAdvanceDeductedMinor = Math.min(disburseModalRow.pendingAdvancesMinorUnits, maxDeductibleAdvanceMinor);
    const netPaidMinor = Math.max(0, disburseModalRow.baseMonthlySalaryMinorUnits + bonusMinor - dedMinor - actualAdvanceDeductedMinor);

    setDisburseSubmitting(true);
    try {
      const res = await window.bakery.payroll.disburseSalary({
        storeId,
        userId: disburseModalRow.userId,
        payrollMonth,
        baseSalaryMinorUnits: disburseModalRow.baseMonthlySalaryMinorUnits,
        advancesDeductedMinorUnits: actualAdvanceDeductedMinor,
        bonusesMinorUnits: bonusMinor,
        deductionsMinorUnits: dedMinor,
        netPaidMinorUnits: netPaidMinor,
        paymentMethod: disbursePaymentMethod,
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: disburseNotes.trim() || undefined,
        createdByUserId: currentUserId,
        createdByName: currentUserName,
      });

      if (res.success) {
        setDisburseModalRow(null);
        loadPayrollSheet();
      } else {
        alert(res.error?.message || 'Failed to disburse salary');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error disbursing salary');
    } finally {
      setDisburseSubmitting(false);
    }
  };

  // Metrics Calculation
  const totalExpensesRs = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amountMinorUnits, 0) / 100;
  }, [expenses]);

  const utilityBillsRs = useMemo(() => {
    return (
      expenses
        .filter((e) => {
          const name = (e.categoryName || '').toLowerCase();
          return name.includes('electric') || name.includes('gas') || name.includes('water') || name.includes('utilit');
        })
        .reduce((sum, e) => sum + e.amountMinorUnits, 0) / 100
    );
  }, [expenses]);

  const repairsRs = useMemo(() => {
    return (
      expenses
        .filter((e) => {
          const name = (e.categoryName || '').toLowerCase();
          return name.includes('repair') || name.includes('maint') || name.includes('equipment') || name.includes('machine');
        })
        .reduce((sum, e) => sum + e.amountMinorUnits, 0) / 100
    );
  }, [expenses]);

  const cashDrawerPayoutsRs = useMemo(() => {
    return (
      expenses
        .filter((e) => e.paymentMethod === 'cash_drawer')
        .reduce((sum, e) => sum + e.amountMinorUnits, 0) / 100
    );
  }, [expenses]);

  const pendingAdvancesTotalRs = useMemo(() => {
    return (
      advances
        .filter((a) => a.status === 'pending')
        .reduce((sum, a) => sum + a.amountMinorUnits, 0) / 100
    );
  }, [advances]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tab Navigation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('expenses')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🧾</span>
            <span>Operating Expenses (Bills & Repairs)</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeSubTab === 'expenses' ? '#3b82f6' : '#e2e8f0',
                color: activeSubTab === 'expenses' ? '#ffffff' : '#475569',
              }}
            >
              {expenses.length}
            </span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'payroll' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('payroll')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid #10b981',
              background: activeSubTab === 'payroll' ? '#10b981' : '#ecfdf5',
              color: activeSubTab === 'payroll' ? '#ffffff' : '#047857',
            }}
          >
            <span>👥</span>
            <span>Staff Payroll, Advances & Benefits</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeSubTab === 'payroll' ? '#047857' : '#a7f3d0',
                color: activeSubTab === 'payroll' ? '#ffffff' : '#065f46',
              }}
            >
              {staffUsers.length} staff
            </span>
            {advances.filter((a) => a.status === 'pending').length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeSubTab === 'payroll' ? '#b45309' : '#fef3c7',
                  color: activeSubTab === 'payroll' ? '#ffffff' : '#b45309',
                  fontWeight: 700,
                }}
              >
                {advances.filter((a) => a.status === 'pending').length} advances
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'expenses') loadExpenses();
              if (activeSubTab === 'payroll') {
                loadPayrollSheet();
                loadAdvances();
              }
            }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: OPERATING EXPENSES (Bills, Repairs, Supplies, Misc)           */}
      {/* ========================================================================= */}
      {activeSubTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '28px', background: '#fee2e2', padding: '10px', borderRadius: '10px' }}>💸</div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Expenses
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>
                  Rs. {totalExpensesRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '28px', background: '#fef3c7', padding: '10px', borderRadius: '10px' }}>⚡</div>
              <div>
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>
                  Utility Bills (Electricity/Gas)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309' }}>
                  Rs. {utilityBillsRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '28px', background: '#e0e7ff', padding: '10px', borderRadius: '10px' }}>🔧</div>
              <div>
                <div style={{ fontSize: '11px', color: '#3730a3', fontWeight: 600, textTransform: 'uppercase' }}>
                  Repairs & Maintenance
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#3730a3' }}>
                  Rs. {repairsRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '28px', background: '#ecfdf5', padding: '10px', borderRadius: '10px' }}>💵</div>
              <div>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                  POS Cash Drawer Payouts
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857' }}>
                  Rs. {cashDrawerPayoutsRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Layout: Full-Width Operating Expenses Ledger */}
          <div className="panel-card" style={{ width: '100%' }}>
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="panel-title">Operating Expenses Ledger</span>
                <span className="panel-badge ok">{expenses.length} records</span>
                <button
                  type="button"
                  onClick={() => setShowCreateExpenseModal(true)}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>+</span>
                  <span>Record New Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(true)}
                  className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Create custom expense head (F9)"
                >
                  <span>📁</span>
                  <span>Add Category (F9)</span>
                </button>
              </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Timeframe selector */}
                  <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    {(['today', 'week', 'month', 'all'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterTimeframe(t)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          borderRight: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          background: filterTimeframe === t ? '#3b82f6' : '#ffffff',
                          color: filterTimeframe === t ? '#ffffff' : '#475569',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Category filter */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="form-input"
                    style={{ width: '150px', height: '30px', fontSize: '11px', padding: '2px 8px' }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={exportExpensesCsv}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    title="Export expense ledger to CSV"
                  >
                    📥 CSV
                  </button>
                </div>
              </div>

              <div className="panel-body" style={{ padding: 0, maxHeight: '620px', overflowY: 'auto' }}>
                {expLoading ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading expenses ledger...
                  </div>
                ) : expenses.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>No Expenses Found</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Record electric bills, shop repairs, or petty expenses using the form on the left.
                    </div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Title / Description</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Amount</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Payment Method</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Paid To / Ref</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => {
                        const amtRs = (e.amountMinorUnits / 100).toFixed(2);
                        return (
                          <tr key={e.id}>
                            <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                              {e.expenseDate}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                {e.categoryName}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{e.title}</div>
                              {e.notes && <div style={{ fontSize: '11px', color: '#64748b' }}>{e.notes}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '14px' }}>
                              Rs. {Number(amtRs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: e.paymentMethod === 'cash_drawer' ? '#ecfdf5' : '#f8fafc',
                                  color: e.paymentMethod === 'cash_drawer' ? '#047857' : '#475569',
                                  border: `1px solid ${e.paymentMethod === 'cash_drawer' ? '#a7f3d0' : '#cbd5e1'}`,
                                }}
                              >
                                {e.paymentMethod === 'cash_drawer'
                                  ? '💵 Cash Drawer'
                                  : e.paymentMethod === 'bank_transfer'
                                  ? '🏦 Bank'
                                  : e.paymentMethod === 'cheque'
                                  ? '🧾 Cheque'
                                  : '💰 Cash'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '11.5px', color: '#64748b' }}>
                              {e.paidTo && <div style={{ fontWeight: 600, color: '#1e293b' }}>{e.paidTo}</div>}
                              {e.voucherNumber && <div>#{e.voucherNumber}</div>}
                              {!e.paidTo && !e.voucherNumber && '—'}
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDeleteExpense(e.id, e.title)}
                                style={{ padding: '3px 8px', fontSize: '11px', color: '#b91c1c' }}
                                title="Delete expense record"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIFIED SUB-TAB 2: STAFF PAYROLL, ADVANCES & BENEFITS                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Month & Actions Header */}
          <div
            className="panel-card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                👥
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                  Staff Payroll & Advances — {new Date(`${payrollMonth}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Click on any staff member to inspect their complete monthly statement, advances, benefits, and payout lines.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {pendingAdvancesTotalRs > 0 && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '12px',
                    color: '#b45309',
                    fontWeight: 700,
                  }}
                  title="Total un-deducted advances across all staff"
                >
                  Pending Advances: Rs. {pendingAdvancesTotalRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Select Month:</label>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="form-input"
                  style={{ width: '160px', height: '34px', fontSize: '13px', fontWeight: 700 }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setAdvUserId(staffUsers[0]?.id || '');
                  setAdvAmountRs('');
                  setAdvReason('');
                  setAdvPaymentMethod('cash_drawer');
                  setAdvDate(new Date().toISOString().slice(0, 10));
                  setShowCreateAdvanceModal(true);
                }}
                className="btn-primary"
                style={{
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f59e0b',
                  borderColor: '#d97706',
                }}
              >
                <span>+</span>
                <span>Issue Staff Advance</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {payrollSheet && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className="panel-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '26px', background: '#f1f5f9', padding: '10px', borderRadius: '10px' }}>💼</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Base Payroll
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    Rs. {(payrollSheet.totalBaseSalaryMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {payrollSheet.rows.length} active staff members
                  </div>
                </div>
              </div>

              <div className="panel-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '26px', background: '#fffbeb', padding: '10px', borderRadius: '10px' }}>⏳</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>
                    Staff Advances Active
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309' }}>
                    Rs. {(payrollSheet.totalAdvancesPendingMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
                    This mo: Rs. {(payrollSheet.totalCurrentMonthAdvancesMinorUnits / 100).toLocaleString()} | Rolled: Rs. {(payrollSheet.totalCarriedOverAdvanceMinorUnits / 100).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="panel-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '26px', background: '#ecfdf5', padding: '10px', borderRadius: '10px' }}>💳</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                    Salaries Disbursed
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857' }}>
                    Rs. {(payrollSheet.totalNetPaidMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                    {payrollSheet.rows.filter((r) => r.status === 'paid').length} of {payrollSheet.rows.length} staff paid
                  </div>
                </div>
              </div>

              <div className="panel-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '26px', background: '#f8fafc', padding: '10px', borderRadius: '10px' }}>📊</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>
                    Net Remaining Due
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>
                    Rs. {Math.max(0, (payrollSheet.totalBaseSalaryMinorUnits - payrollSheet.totalAdvancesPendingMinorUnits - payrollSheet.totalNetPaidMinorUnits) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Pending payout for {payrollMonth}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unified Staff Payroll Table */}
          <div className="panel-card">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="panel-title">Staff Monthly Payroll & Advances Summary</span>
                <span className="panel-badge ok">{payrollSheet?.rows.length || 0} staff</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                💡 <em>Tip: Click any employee name or <strong>Statement</strong> button to see full breakdown.</em>
              </div>
            </div>

            <div className="panel-body" style={{ padding: 0, maxHeight: '620px', overflowY: 'auto' }}>
              {payrollLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading staff payroll sheet...</div>
              ) : !payrollSheet || payrollSheet.rows.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>No Staff Members Found</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Add staff accounts in the Staff & Roles tab to manage payroll.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Staff Member (Click for Statement)</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Designation</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Base Salary</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Advances Taken</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Benefits & Deductions</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Net Payable / Status</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollSheet.rows.map((row) => {
                      const baseRs = row.baseMonthlySalaryMinorUnits / 100;
                      const advRs = row.pendingAdvancesMinorUnits / 100;
                      const isPaid = row.status === 'paid';
                      const isOverAdvanced = row.status === 'over_advanced';
                      const matchingUser = staffUsers.find((u) => u.id === row.userId);

                      const netPayable = isPaid && row.paidRecord
                        ? row.paidRecord.netPaidMinorUnits / 100
                        : Math.max(0, baseRs - advRs);

                      return (
                        <tr
                          key={row.userId}
                          style={{
                            background: isPaid ? '#f0fdf4' : isOverAdvanced ? '#fffbeb' : undefined,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Staff Name with avatar & click trigger */}
                          <td style={{ padding: '10px 12px' }}>
                            <div
                              onClick={() => handleOpenStatement(row.userId)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                              }}
                              title="Click to view detailed monthly statement & line breakdown"
                            >
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: isPaid ? '#dcfce7' : '#e0f2fe',
                                  color: isPaid ? '#15803d' : '#0369a1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 800,
                                }}
                              >
                                {row.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}>
                                  {row.displayName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  @{row.username} • <span style={{ color: '#0284c7', fontWeight: 600 }}>📜 View Statement</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Designation */}
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: '#f1f5f9',
                                color: '#334155',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              {row.designation}
                            </span>
                          </td>

                          {/* Base Salary */}
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Rs. {baseRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {isAdmin && matchingUser && !isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSalary(matchingUser, baseRs, row.designation)}
                                  className="btn-secondary"
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    color: baseRs <= 0 ? '#0284c7' : '#475569',
                                    background: baseRs <= 0 ? '#e0f2fe' : '#f1f5f9',
                                    borderColor: baseRs <= 0 ? '#bae6fd' : '#cbd5e1',
                                  }}
                                  title="Edit monthly base salary"
                                >
                                  {baseRs <= 0 ? '✏️ Set' : '✏️'}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Advances Taken */}
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {advRs > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStatement(row.userId)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      cursor: 'pointer',
                                      fontWeight: 800,
                                      color: '#b45309',
                                      fontSize: '13px',
                                      textDecoration: 'underline',
                                      textDecorationColor: '#fde68a',
                                    }}
                                    title="Click to view full advance statement"
                                  >
                                    -Rs. {advRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Rs. 0.00</span>
                                )}

                                {!isPaid && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAdvanceForStaff(row.userId)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      color: '#b45309',
                                      background: '#fffbeb',
                                      borderColor: '#fde68a',
                                    }}
                                    title={`Issue immediate advance for ${row.displayName}`}
                                  >
                                    + Adv
                                  </button>
                                )}
                              </div>

                              {row.carriedOverAdvanceMinorUnits > 0 && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontWeight: 600,
                                  }}
                                  title="Advance carried over from previous month"
                                >
                                  Includes Rs. {(row.carriedOverAdvanceMinorUnits / 100).toLocaleString()} rolled over
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Benefits & Deductions */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px' }}>
                            {isPaid && row.paidRecord ? (
                              <div>
                                {row.paidRecord.bonusesMinorUnits > 0 && (
                                  <div style={{ color: '#059669', fontWeight: 600 }}>
                                    +Rs. {(row.paidRecord.bonusesMinorUnits / 100).toLocaleString()}
                                  </div>
                                )}
                                {row.paidRecord.deductionsMinorUnits > 0 && (
                                  <div style={{ color: '#dc2626', fontWeight: 600 }}>
                                    -Rs. {(row.paidRecord.deductionsMinorUnits / 100).toLocaleString()}
                                  </div>
                                )}
                                {!row.paidRecord.bonusesMinorUnits && !row.paidRecord.deductionsMinorUnits && (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Net Payable / Status */}
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {isPaid ? (
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: '#047857' }}>
                                  Rs. {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    border: '1px solid #a7f3d0',
                                  }}
                                >
                                  🟢 Paid
                                </span>
                              </div>
                            ) : isOverAdvanced ? (
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '13px', color: '#dc2626' }}>
                                  ⚠️ Over-Advanced
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: 600 }}>
                                  Excess Rs. {(row.overAdvancedMinorUnits / 100).toLocaleString()} rolls over
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                                  Rs. {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                  }}
                                >
                                  🟡 Due
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                              {!isPaid ? (
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => handleOpenDisburseModal(row)}
                                  disabled={baseRs <= 0}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    background: isOverAdvanced ? '#f59e0b' : '#10b981',
                                    borderColor: isOverAdvanced ? '#d97706' : '#059669',
                                  }}
                                  title={baseRs <= 0 ? 'Set base salary first' : 'Disburse month salary'}
                                >
                                  💳 Pay Salary
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setPaySlipRow(row)}
                                  style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 600 }}
                                  title="View and print salary pay slip"
                                >
                                  🖨️ Pay Slip
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleOpenStatement(row.userId)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: '#0284c7',
                                  borderColor: '#bae6fd',
                                  background: '#f0f9ff',
                                }}
                                title="Open detailed monthly statement popup"
                              >
                                📜 Statement
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK ADD EXPENSE CATEGORY                                        */}
      {/* ========================================================================= */}
      {showAddCatModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>+ New Expense Category</h3>
              <button
                type="button"
                onClick={() => setShowAddCatModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Generator Diesel, Legal Fees, Printing"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="form-input"
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddCatModal(false)} className="btn-secondary" disabled={catSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={catSubmitting || !newCatName.trim()} style={{ fontWeight: 700 }}>
                  {catSubmitting ? 'Saving...' : '💾 Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT BASE SALARY                                                   */}
      {/* ========================================================================= */}
      {profileModalStaff && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Set Staff Monthly Base Salary</h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {profileModalStaff.displayName} (@{profileModalStaff.username})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalStaff(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSalaryProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Monthly Base Salary (Rs.) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 35000"
                  value={editSalaryRs}
                  onChange={(e) => setEditSalaryRs(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '15px', fontWeight: 700 }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="form-label">Designation / Role Title</label>
                <input
                  type="text"
                  placeholder="e.g. Head Baker, Counter Cashier"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setProfileModalStaff(null)} className="btn-secondary" disabled={profileSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={profileSubmitting} style={{ fontWeight: 700 }}>
                  {profileSubmitting ? 'Saving...' : '💾 Save Salary Setting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISBURSE MONTHLY SALARY                                            */}
      {/* ========================================================================= */}
      {disburseModalRow && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Process Salary Disbursement</h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Staff: <strong>{disburseModalRow.displayName}</strong> | Month: <strong>{payrollMonth}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisburseModalRow(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDisburseSalary} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Financial Breakdown Box */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                  <span>Base Monthly Salary:</span>
                  <strong style={{ color: '#0f172a' }}>Rs. {(disburseModalRow.baseMonthlySalaryMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>

                {disburseModalRow.pendingAdvancesMinorUnits > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                      <span>Less: Advances Deducted Now:</span>
                      <strong>
                        -Rs.{' '}
                        {Math.min(
                          (disburseModalRow.baseMonthlySalaryMinorUnits / 100) + (parseFloat(disburseBonusRs) || 0) - (parseFloat(disburseDeductionsRs) || 0),
                          disburseModalRow.pendingAdvancesMinorUnits / 100
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>

                    {disburseModalRow.pendingAdvancesMinorUnits >
                      disburseModalRow.baseMonthlySalaryMinorUnits + Math.round((parseFloat(disburseBonusRs) || 0) * 100) - Math.round((parseFloat(disburseDeductionsRs) || 0) * 100) && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: '#92400e',
                          fontSize: '11px',
                          lineHeight: 1.4,
                        }}
                      >
                        ⚠️ <strong>Advance Exceeds Salary:</strong> Total advances are Rs.{' '}
                        {(disburseModalRow.pendingAdvancesMinorUnits / 100).toLocaleString()}. The remaining excess of{' '}
                        <strong>
                          Rs.{' '}
                          {(
                            (disburseModalRow.pendingAdvancesMinorUnits -
                              Math.max(
                                0,
                                disburseModalRow.baseMonthlySalaryMinorUnits +
                                  Math.round((parseFloat(disburseBonusRs) || 0) * 100) -
                                  Math.round((parseFloat(disburseDeductionsRs) || 0) * 100)
                              )) /
                            100
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>{' '}
                        will automatically roll over as an advance into next month.
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Add: Bonus / Overtime:</span>
                  <strong>+Rs. {(parseFloat(disburseBonusRs) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Less: Other Deductions / Penalties:</span>
                  <strong>-Rs. {(parseFloat(disburseDeductionsRs) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px solid #cbd5e1',
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#047857',
                  }}
                >
                  <span>Net Salary Payable:</span>
                  <span>Rs. {calculateDisburseNet().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Bonus / Overtime (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={disburseBonusRs}
                    onChange={(e) => setDisburseBonusRs(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Deductions (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={disburseDeductionsRs}
                    onChange={(e) => setDisburseDeductionsRs(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Payment Channel *</label>
                <select
                  value={disbursePaymentMethod}
                  onChange={(e) => setDisbursePaymentMethod(e.target.value)}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                >
                  <option value="cash_hand">💰 Direct Cash in Hand</option>
                  <option value="bank_transfer">🏦 Bank Account Transfer</option>
                  <option value="cash_drawer">💵 POS Cash Register Drawer (Auto-logs shift payout)</option>
                  <option value="cheque">🧾 Cheque</option>
                </select>
              </div>

              <div>
                <label className="form-label">Notes / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Transferred via HBL or handed over in cash"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setDisburseModalRow(null)} className="btn-secondary" disabled={disburseSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={disburseSubmitting} style={{ fontWeight: 700, background: '#10b981' }}>
                  {disburseSubmitting ? 'Processing...' : '✓ Confirm & Pay Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE SALARY PAY SLIP                                          */}
      {/* ========================================================================= */}
      {paySlipRow && paySlipRow.paidRecord && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>📄 Official Salary Pay Slip</h3>
              <button
                type="button"
                onClick={() => setPaySlipRow(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div
              id="printable-payslip"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '20px',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>BAKERY STORE</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>STAFF SALARY VOUCHER</div>
                <div style={{ fontWeight: 700, marginTop: '4px' }}>Month: {paySlipRow.paidRecord.payrollMonth}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Employee:</span>
                <strong>{paySlipRow.displayName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Handle:</span>
                <span>@{paySlipRow.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Designation:</span>
                <span>{paySlipRow.designation}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Payment Date:</span>
                <span>{paySlipRow.paidRecord.paymentDate}</span>
              </div>

              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Base Salary:</span>
                <span>Rs. {(paySlipRow.paidRecord.baseSalaryMinorUnits / 100).toFixed(2)}</span>
              </div>
              {paySlipRow.paidRecord.advancesDeductedMinorUnits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#b45309' }}>
                  <span>Advances Deducted:</span>
                  <span>-Rs. {(paySlipRow.paidRecord.advancesDeductedMinorUnits / 100).toFixed(2)}</span>
                </div>
              )}
              {paySlipRow.paidRecord.bonusesMinorUnits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#059669' }}>
                  <span>Bonuses / Overtime:</span>
                  <span>+Rs. {(paySlipRow.paidRecord.bonusesMinorUnits / 100).toFixed(2)}</span>
                </div>
              )}
              {paySlipRow.paidRecord.deductionsMinorUnits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#dc2626' }}>
                  <span>Other Deductions:</span>
                  <span>-Rs. {(paySlipRow.paidRecord.deductionsMinorUnits / 100).toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14px', color: '#047857' }}>
                <span>Net Salary Paid:</span>
                <span>Rs. {(paySlipRow.paidRecord.netPaidMinorUnits / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                <span>Channel:</span>
                <span style={{ textTransform: 'uppercase' }}>{paySlipRow.paidRecord.paymentMethod}</span>
              </div>
              {paySlipRow.paidRecord.notes && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Memo: {paySlipRow.paidRecord.notes}
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                <span>Disbursed by: {paySlipRow.paidRecord.createdByName}</span>
                <span>Employee Signature: ________</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button type="button" onClick={() => setPaySlipRow(null)} className="btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary"
                style={{ fontWeight: 700 }}
              >
                🖨️ Print Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMPLOYEE MONTHLY STATEMENT & DETAILED BREAKDOWN                    */}
      {/* ========================================================================= */}
      {statementUserId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '920px',
              width: '94vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            {/* Modal Header */}
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '12px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  {statementData ? statementData.displayName.charAt(0).toUpperCase() : '👤'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{statementData ? statementData.displayName : 'Staff Member'}</span>
                    {statementData && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600,
                        }}
                      >
                        {statementData.designation}
                      </span>
                    )}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Monthly Statement & Activity Breakdown • @{statementData?.username || ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Month:</label>
                  <input
                    type="month"
                    value={statementMonth}
                    onChange={(e) => setStatementMonth(e.target.value)}
                    className="form-input"
                    style={{ width: '150px', height: '32px', fontSize: '12.5px', fontWeight: 700 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Print this statement"
                >
                  <span>🖨️</span>
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementUserId(null)}
                  style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              {statementLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading employee statement & transaction lines...
                </div>
              ) : !statementData ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
                  Failed to load employee statement.
                </div>
              ) : (
                <>
                  {/* Financial KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Base Monthly Salary</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        Rs. {(statementData.baseSalaryMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total Advances
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                        -Rs. {(statementData.totalAdvancesMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      {statementData.carriedOverAdvanceMinorUnits > 0 && (
                        <div style={{ fontSize: '10.5px', color: '#d97706', marginTop: '2px', fontWeight: 600 }}>
                          (Rs. {(statementData.carriedOverAdvanceMinorUnits / 100).toLocaleString()} rolled over from prev)
                        </div>
                      )}
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Bonuses & Benefits</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                        +Rs. {(statementData.totalBonusesMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      {statementData.totalDeductionsMinorUnits > 0 && (
                        <div style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
                          -Rs. {(statementData.totalDeductionsMinorUnits / 100).toLocaleString()} deductions
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        background: statementData.status === 'paid' ? '#ecfdf5' : statementData.status === 'over_advanced' ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${statementData.status === 'paid' ? '#a7f3d0' : statementData.status === 'over_advanced' ? '#fca5a5' : '#bbf7d0'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: statementData.status === 'paid' ? '#047857' : statementData.status === 'over_advanced' ? '#b91c1c' : '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                        {statementData.status === 'paid' ? 'Net Paid' : statementData.status === 'over_advanced' ? 'Over-Advanced' : 'Net Due Payable'}
                      </div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          color: statementData.status === 'paid' ? '#047857' : statementData.status === 'over_advanced' ? '#b91c1c' : '#0f172a',
                          marginTop: '2px',
                        }}
                      >
                        Rs. {(statementData.netPayableMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10.5px', marginTop: '2px', fontWeight: 700, color: statementData.status === 'paid' ? '#047857' : statementData.status === 'over_advanced' ? '#b91c1c' : '#b45309' }}>
                        {statementData.status === 'paid' ? '🟢 Disbursed & Settled' : statementData.status === 'over_advanced' ? '⚠️ Excess rolls over to next month' : '🟡 Unpaid / Due'}
                      </div>
                    </div>
                  </div>

                  {/* Over-advance explanatory alert if applicable */}
                  {statementData.status === 'over_advanced' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>ℹ️</span>
                      <span>
                        <strong>Note on Advance Exceeding Salary:</strong> This staff member has received Rs.{' '}
                        {(statementData.totalAdvancesMinorUnits / 100).toLocaleString()} in advances against a base salary of Rs.{' '}
                        {(statementData.baseSalaryMinorUnits / 100).toLocaleString()}. When monthly salary is processed, the base salary is fully offset, and the remaining excess of Rs.{' '}
                        {((statementData.totalAdvancesMinorUnits - statementData.baseSalaryMinorUnits) / 100).toLocaleString()} will automatically be carried over into next month as an advance deduction.
                      </span>
                    </div>
                  )}

                  {/* Line Items Table */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                        Line-by-Line Activity & Payout Breakdown ({statementData.entries.length} items)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAdvanceForStaff(statementData.userId)}
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 700 }}
                      >
                        + Issue Advance
                      </button>
                    </div>

                    {statementData.entries.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No advance, bonus, or salary transactions recorded for {statementMonth}.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', fontSize: '11.5px' }}>
                              <th style={{ textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '115px' }}>Date & Time</th>
                              <th style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '130px' }}>Type</th>
                              <th style={{ textAlign: 'right', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '110px' }}>Amount (Rs.)</th>
                              <th style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '140px' }}>Channel</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '110px' }}>Reference / Shift</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: '150px' }}>Notes & Remarks</th>
                              <th style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '140px' }}>Status</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '110px' }}>Logged By</th>
                              <th style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap', minWidth: '80px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statementData.entries.map((entry) => {
                              const isAdvance = entry.type === 'advance';
                              const isSalary = entry.type === 'salary_payment';
                              const isBonus = entry.type === 'bonus';
                              const isDed = entry.type === 'deduction';
                              const amt = (entry.amountMinorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

                              const isDrawer = entry.paymentMethod === 'cash_drawer';
                              const isBank = entry.paymentMethod === 'bank_transfer';
                              const channelLabel = isDrawer ? '💵 Cash Drawer' : isBank ? '🏦 Bank' : '💰 Cash in Hand';
                              const channelBg = isDrawer ? '#f0fdf4' : isBank ? '#eff6ff' : '#fefce8';
                              const channelBorder = isDrawer ? '#bbf7d0' : isBank ? '#bfdbfe' : '#fef08a';
                              const channelColor = isDrawer ? '#166534' : isBank ? '#1d4ed8' : '#854d0e';

                              const isPending = entry.status.toLowerCase().includes('pending');
                              const isPaidOrSettled = entry.status.toLowerCase().includes('paid') || entry.status.toLowerCase().includes('deducted');
                              const statusBg = isPaidOrSettled ? '#ecfdf5' : '#fef3c7';
                              const statusColor = isPaidOrSettled ? '#047857' : '#b45309';
                              const statusBorder = isPaidOrSettled ? '#a7f3d0' : '#fde68a';

                              return (
                                <tr key={`${entry.type}-${entry.id}`}>
                                  <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                    {entry.date}
                                    {entry.createdAtUtc && (
                                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>
                                        {new Date(entry.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    )}
                                  </td>

                                  <td style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '3px 9px',
                                        borderRadius: '9999px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: isAdvance ? '#fef3c7' : isSalary ? '#ecfdf5' : isBonus ? '#dcfce7' : '#fee2e2',
                                        color: isAdvance ? '#b45309' : isSalary ? '#047857' : isBonus ? '#15803d' : '#b91c1c',
                                        border: `1px solid ${isAdvance ? '#fde68a' : isSalary ? '#a7f3d0' : isBonus ? '#bbf7d0' : '#fecaca'}`,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isAdvance ? '💵 Advance' : isSalary ? '💳 Salary Payout' : isBonus ? '🎁 Bonus' : '🔻 Deduction'}
                                    </span>
                                  </td>

                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '10px 12px',
                                      fontWeight: 800,
                                      fontSize: '13px',
                                      color: isAdvance ? '#b45309' : isSalary ? '#047857' : isBonus ? '#15803d' : '#b91c1c',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isAdvance || isDed ? '-' : '+'}Rs. {amt}
                                  </td>

                                  <td style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: channelBg,
                                        border: `1px solid ${channelBorder}`,
                                        color: channelColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {channelLabel}
                                    </span>
                                  </td>

                                  <td style={{ padding: '10px 12px', fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                                    {entry.reference || '—'}
                                  </td>

                                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#334155' }}>
                                    {entry.notes || '—'}
                                  </td>

                                  <td style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: statusBg,
                                        color: statusColor,
                                        border: `1px solid ${statusBorder}`,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isPaidOrSettled ? '✓ ' : '⏳ '}{entry.status}
                                    </span>
                                  </td>

                                  <td style={{ padding: '10px 12px', fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {entry.createdByName || 'Admin'}
                                  </td>

                                  <td style={{ textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                    {isAdvance && isPending ? (
                                      (() => {
                                        const advObj = advances.find((a) => a.id === entry.id);
                                        return advObj ? (
                                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              onClick={() => handleOpenEditAdvance(advObj)}
                                              style={{ padding: '2px 6px', fontSize: '11px' }}
                                              title="Edit advance amount or date"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              onClick={() => handleDeleteAdvance(advObj)}
                                              style={{ padding: '2px 6px', fontSize: '11px', color: '#b91c1c' }}
                                              title="Cancel / Delete advance record"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        ) : (
                                          <span style={{ color: '#cbd5e1' }}>—</span>
                                        );
                                      })()
                                    ) : (
                                      <span style={{ color: '#cbd5e1' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Store ID: <strong>#{storeId}</strong> • Logged by: <strong>{currentUserName}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setStatementUserId(null)} className="btn-secondary" style={{ padding: '6px 14px' }}>
                  Close
                </button>
                <button type="button" onClick={() => window.print()} className="btn-primary" style={{ padding: '6px 16px', fontWeight: 700 }}>
                  🖨️ Print Statement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT PENDING SALARY ADVANCE                                        */}
      {/* ========================================================================= */}
      {editAdvanceModal && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div
              className="modal-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>✏️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Edit Staff Advance</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Staff: <strong>{editAdvanceModal.displayName}</strong> (@{editAdvanceModal.username})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditAdvance}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Correct Advance Amount (Rs.) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editAdvAmountRs}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setEditAdvAmountRs(val);
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: '16px', fontWeight: 700 }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Advance Date *</label>
                <input
                  type="date"
                  value={editAdvDate}
                  onChange={(e) => setEditAdvDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Payment Channel</label>
                <select
                  value={editAdvPaymentMethod}
                  onChange={(e) => setEditAdvPaymentMethod(e.target.value)}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                >
                  <option value="cash_drawer">💵 POS Cash Register Drawer</option>
                  <option value="cash_hand">💰 Direct Cash in Hand</option>
                  <option value="bank_transfer">🏦 Bank Account Transfer</option>
                </select>
              </div>

              <div>
                <label className="form-label">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency family expense"
                  value={editAdvReason}
                  onChange={(e) => setEditAdvReason(e.target.value)}
                  className="form-input"
                />
              </div>

              {editAdvMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: editAdvMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                    color: editAdvMsg.type === 'ok' ? '#047857' : '#b91c1c',
                    border: `1px solid ${editAdvMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                  }}
                >
                  {editAdvMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleCloseEditAdvance}
                  className="btn-secondary"
                  disabled={editAdvSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editAdvSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {editAdvSubmitting ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD NEW OPERATING EXPENSE                                       */}
      {/* ========================================================================= */}
      {showCreateExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '540px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💸</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Record Operating Expense</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Post a direct business expense or cash drawer payout</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateExpenseModal(false);
                  setExpMsg(null);
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Expense Category / Head *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={expCategoryId}
                      onChange={(e) => setExpCategoryId(Number(e.target.value))}
                      className="form-input"
                      style={{ fontWeight: 600, flex: 1 }}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddCatModal(true)}
                      className="btn-secondary"
                      style={{ padding: '0 8px', fontSize: '13px' }}
                      title="Add new category"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 1500"
                    value={expAmountRs}
                    onChange={(e) => setExpAmountRs(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    className="form-input"
                    style={{ fontSize: '15px', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Expense Title / Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Purchased 20L diesel for generator"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Payment Channel *</label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value as 'cash_drawer' | 'cash_hand' | 'bank_transfer' | 'cheque')}
                    className="form-input"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="cash_drawer">💵 POS Cash Register Drawer</option>
                    <option value="cash_hand">💰 Direct Cash in Hand</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="cheque">🧾 Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Expense Date *</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Paid To / Beneficiary</label>
                  <input
                    type="text"
                    placeholder="e.g. Shell Petrol Pump / Tariq"
                    value={expPaidTo}
                    onChange={(e) => setExpPaidTo(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Receipt / Voucher #</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-8492"
                    value={expVoucherNo}
                    onChange={(e) => setExpVoucherNo(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Internal Notes</label>
                <input
                  type="text"
                  placeholder="Optional internal remarks or reason"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              {expPaymentMethod === 'cash_drawer' && (
                <div
                  style={{
                    background: '#eff6ff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    lineHeight: 1.4,
                  }}
                >
                  ℹ️ <strong>Cash Drawer Linked:</strong> This expense will be deducted from today's active POS cash register drawer and recorded in the shift reconciliation.
                </div>
              )}

              {expMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: expMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                    color: expMsg.type === 'ok' ? '#047857' : '#b91c1c',
                    border: `1px solid ${expMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                  }}
                >
                  {expMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateExpenseModal(false);
                    setExpMsg(null);
                  }}
                  className="btn-secondary"
                  disabled={expSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={expSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {expSubmitting ? 'Saving...' : '💾 Save & Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ISSUE STAFF SALARY ADVANCE                                         */}
      {/* ========================================================================= */}
      {showCreateAdvanceModal && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💸</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Issue Staff Advance</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Provide an advance against monthly salary</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateAdvanceModal(false);
                  setAdvMsg(null);
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Select Staff Member *</label>
                <select
                  value={advUserId || (staffUsers[0]?.id ?? '')}
                  onChange={(e) => setAdvUserId(Number(e.target.value))}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                  required
                >
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Advance Amount (Rs.) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5000"
                    value={advAmountRs}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setAdvAmountRs(val);
                      }
                    }}
                    className="form-input"
                    style={{ fontSize: '15px', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Payment Channel *</label>
                <select
                  value={advPaymentMethod}
                  onChange={(e) => setAdvPaymentMethod(e.target.value)}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                >
                  <option value="cash_drawer">💵 POS Cash Register Drawer (Auto-logs shift payout)</option>
                  <option value="cash_hand">💰 Direct Cash in Hand</option>
                  <option value="bank_transfer">🏦 Bank Account Transfer</option>
                </select>
              </div>

              <div>
                <label className="form-label">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency family medical expense"
                  value={advReason}
                  onChange={(e) => setAdvReason(e.target.value)}
                  className="form-input"
                />
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  lineHeight: 1.4,
                }}
              >
                💡 <strong>Automatic Month-End Deduction:</strong> Pending advances will be automatically subtracted from this staff member's salary on the Month-End Payroll Sheet.
              </div>

              {advMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: advMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                    color: advMsg.type === 'ok' ? '#047857' : '#b91c1c',
                    border: `1px solid ${advMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                  }}
                >
                  {advMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAdvanceModal(false);
                    setAdvMsg(null);
                  }}
                  className="btn-secondary"
                  disabled={advSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={advSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {advSubmitting ? 'Saving...' : '💾 Issue & Save Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
