import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Stakeholder,
  CreateStakeholderInput,
  UpdateStakeholderEquityInput,
  StakeholderTransaction,
  CreateStakeholderTxInput,
  FiscalPeriod,
  CreateFiscalPeriodInput,
  ProfitDistributionRun,
  CompanyPnlSummary,
} from '@rz-crm/contracts';

interface StakeholdersTabProps {
  storeId: number;
  currentUserName: string;
  currentUserRole?: string;
}

export const StakeholdersTab: React.FC<StakeholdersTabProps> = ({
  storeId,
  currentUserName: _currentUserName,
  currentUserRole: _currentUserRole,
}) => {
  // Navigation Subtabs
  const [activeSubTab, setActiveSubTab] = useState<'stakeholders' | 'ledger' | 'distributions' | 'pnl'>('stakeholders');

  // Main State
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [transactions, setTransactions] = useState<StakeholderTransaction[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [distributionRuns, setDistributionRuns] = useState<ProfitDistributionRun[]>([]);
  const [pnlSummary, setPnlSummary] = useState<CompanyPnlSummary | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ledgerStakeholderFilter, setLedgerStakeholderFilter] = useState<string>('all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('all');

  // Modal: Register Stakeholder
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addFullName, setAddFullName] = useState<string>('');
  const [addCnic, setAddCnic] = useState<string>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addAddress, setAddAddress] = useState<string>('');
  const [addType, setAddType] = useState<'OWNER' | 'PARTNER' | 'INVESTOR' | 'SILENT_PARTNER'>('PARTNER');
  const [addJoinedDate, setAddJoinedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [addShareMode, setAddShareMode] = useState<'FIXED_PERCENT' | 'CAPITAL_PROPORTIONAL'>('FIXED_PERCENT');
  const [addOwnershipPercent, setAddOwnershipPercent] = useState<string>('25');
  const [addProfitSharePercent, setAddProfitSharePercent] = useState<string>('25');
  const [addLossSharePercent, setAddLossSharePercent] = useState<string>('25');
  const [addInitialCapitalRs, setAddInitialCapitalRs] = useState<string>('500000');
  const [addPaymentMethod, setAddPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');
  const [addNotes, setAddNotes] = useState<string>('');
  const [savingStakeholder, setSavingStakeholder] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal: Edit Equity Ratio
  const [showEquityModal, setShowEquityModal] = useState<boolean>(false);
  const [equityTarget, setEquityTarget] = useState<Stakeholder | null>(null);
  const [equityShareMode, setEquityShareMode] = useState<'FIXED_PERCENT' | 'CAPITAL_PROPORTIONAL'>('FIXED_PERCENT');
  const [equityOwnershipPercent, setEquityOwnershipPercent] = useState<string>('0');
  const [equityProfitPercent, setEquityProfitPercent] = useState<string>('0');
  const [equityLossPercent, setEquityLossPercent] = useState<string>('0');
  const [equityEffectiveDate, setEquityEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [equityNotes, setEquityNotes] = useState<string>('');
  const [savingEquity, setSavingEquity] = useState<boolean>(false);
  const [equityError, setEquityError] = useState<string | null>(null);

  // Modal: Record Capital / Drawings Transaction
  const [showTxModal, setShowTxModal] = useState<boolean>(false);
  const [txStakeholderId, setTxStakeholderId] = useState<number | ''>('');
  const [txType, setTxType] = useState<
    | 'CAPITAL_INTRODUCED'
    | 'ADDITIONAL_INVESTMENT'
    | 'CAPITAL_WITHDRAWAL'
    | 'DRAWINGS'
    | 'LOAN_IN'
    | 'LOAN_REPAYMENT'
  >('ADDITIONAL_INVESTMENT');
  const [txAmountRs, setTxAmountRs] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');
  const [txReference, setTxReference] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [txNotes, setTxNotes] = useState<string>('');
  const [savingTx, setSavingTx] = useState<boolean>(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Modal: Create Fiscal Period
  const [showPeriodModal, setShowPeriodModal] = useState<boolean>(false);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [periodStartDate, setPeriodStartDate] = useState<string>('');
  const [periodEndDate, setPeriodEndDate] = useState<string>('');
  const [periodNotes, setPeriodNotes] = useState<string>('');
  const [savingPeriod, setSavingPeriod] = useState<boolean>(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Modal: Calculate & Run Distribution
  const [showRunModal, setShowRunModal] = useState<boolean>(false);
  const [runPeriodId, setRunPeriodId] = useState<number | ''>('');
  const [runRetentionPercent, setRunRetentionPercent] = useState<string>('0');
  const [runNotes, setRunNotes] = useState<string>('');
  const [previewCalculation, setPreviewCalculation] = useState<ProfitDistributionRun | null>(null);
  const [calculatingPreview, setCalculatingPreview] = useState<boolean>(false);
  const [submittingRun, setSubmittingRun] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Load All Stakeholder Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [stkRes, txRes, perRes, runsRes, pnlRes] = await Promise.all([
        window.bakery.stakeholders.list(storeId),
        window.bakery.stakeholders.listTransactions(storeId),
        window.bakery.stakeholders.listPeriods(storeId),
        window.bakery.stakeholders.listDistributionRuns(storeId),
        window.bakery.stakeholders.getPnlSummary(storeId),
      ]);

      if (stkRes.success) setStakeholders(stkRes.data);
      if (txRes.success) setTransactions(txRes.data);
      if (perRes.success) setPeriods(perRes.data);
      if (runsRes.success) setDistributionRuns(runsRes.data);
      if (pnlRes.success) setPnlSummary(pnlRes.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load stakeholders data');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message helper
  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // KPI Computations
  const totalCapitalInvestedRs = useMemo(() => {
    return stakeholders.reduce((sum, s) => sum + Math.max(0, (s.capitalBalanceMinorUnits || 0) / 100), 0);
  }, [stakeholders]);

  const totalDrawingsRs = useMemo(() => {
    return stakeholders.reduce((sum, s) => sum + ((s.totalDrawingsMinorUnits || 0) / 100), 0);
  }, [stakeholders]);

  const netCompanyProfitRs = useMemo(() => {
    return (pnlSummary?.netProfitMinorUnits || 0) / 100;
  }, [pnlSummary]);

  const activePartnersCount = useMemo(() => {
    return stakeholders.filter((s) => s.status === 'ACTIVE').length;
  }, [stakeholders]);

  // Filtered Stakeholders
  const filteredStakeholders = useMemo(() => {
    return stakeholders.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.cnicOrTaxId && s.cnicOrTaxId.includes(searchTerm));

      const matchType = typeFilter === 'all' || s.stakeholderType === typeFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [stakeholders, searchTerm, typeFilter, statusFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchStk =
        ledgerStakeholderFilter === 'all' || t.stakeholderId.toString() === ledgerStakeholderFilter;
      const matchType = ledgerTypeFilter === 'all' || t.type === ledgerTypeFilter;
      return matchStk && matchType;
    });
  }, [transactions, ledgerStakeholderFilter, ledgerTypeFilter]);

  // Handlers: Register Stakeholder
  const handleSaveStakeholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim()) {
      setAddError('Full name is required');
      return;
    }

    setSavingStakeholder(true);
    setAddError(null);

    try {
      const ownershipBps = Math.round(parseFloat(addOwnershipPercent || '0') * 100);
      const profitShareBps = Math.round(parseFloat(addProfitSharePercent || '0') * 100);
      const lossShareBps = Math.round(parseFloat(addLossSharePercent || '0') * 100);
      const initialCapitalMinorUnits = Math.round(parseFloat(addInitialCapitalRs || '0') * 100);

      const input: CreateStakeholderInput = {
        fullName: addFullName.trim(),
        cnicOrTaxId: addCnic.trim() || undefined,
        phone: addPhone.trim() || undefined,
        email: addEmail.trim() || undefined,
        address: addAddress.trim() || undefined,
        stakeholderType: addType,
        joinedDate: addJoinedDate,
        shareMode: addShareMode,
        ownershipBps,
        profitShareBps,
        lossShareBps,
        initialCapitalMinorUnits,
        initialPaymentMethod: addPaymentMethod,
        notes: addNotes.trim() || undefined,
      };

      const res = await window.bakery.stakeholders.create(input);
      if (res.success) {
        showToast(`Stakeholder ${res.data.fullName} (${res.data.code}) registered successfully!`);
        setShowAddModal(false);
        // Reset form
        setAddFullName('');
        setAddCnic('');
        setAddPhone('');
        setAddEmail('');
        setAddAddress('');
        setAddInitialCapitalRs('500000');
        setAddNotes('');
        await loadData();
      } else {
        setAddError(res.error?.message || 'Failed to register stakeholder');
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Error registering stakeholder');
    } finally {
      setSavingStakeholder(false);
    }
  };

  // Handlers: Update Equity
  const handleOpenEquityModal = (s: Stakeholder) => {
    setEquityTarget(s);
    setEquityShareMode(s.currentEquity?.shareMode || 'FIXED_PERCENT');
    setEquityOwnershipPercent(((s.currentEquity?.ownershipBps || 0) / 100).toString());
    setEquityProfitPercent(((s.currentEquity?.profitShareBps || 0) / 100).toString());
    setEquityLossPercent(((s.currentEquity?.lossShareBps || 0) / 100).toString());
    setEquityEffectiveDate(new Date().toISOString().slice(0, 10));
    setEquityNotes('');
    setEquityError(null);
    setShowEquityModal(true);
  };

  const handleSaveEquity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equityTarget) return;

    setSavingEquity(true);
    setEquityError(null);

    try {
      const ownershipBps = Math.round(parseFloat(equityOwnershipPercent || '0') * 100);
      const profitShareBps = Math.round(parseFloat(equityProfitPercent || '0') * 100);
      const lossShareBps = Math.round(parseFloat(equityLossPercent || '0') * 100);

      const input: UpdateStakeholderEquityInput = {
        stakeholderId: equityTarget.id,
        shareMode: equityShareMode,
        ownershipBps,
        profitShareBps,
        lossShareBps,
        effectiveFrom: equityEffectiveDate,
        notes: equityNotes.trim() || undefined,
      };

      const res = await window.bakery.stakeholders.updateEquity(input);
      if (res.success) {
        showToast(`Updated equity ratio for ${equityTarget.fullName}`);
        setShowEquityModal(false);
        await loadData();
      } else {
        setEquityError(res.error?.message || 'Failed to update equity');
      }
    } catch (err: unknown) {
      setEquityError(err instanceof Error ? err.message : 'Error updating equity');
    } finally {
      setSavingEquity(false);
    }
  };

  // Handlers: Record Capital Transaction
  const handleOpenTxModal = (stakeholderId?: number) => {
    setTxStakeholderId(stakeholderId || (stakeholders[0]?.id ?? ''));
    setTxType('ADDITIONAL_INVESTMENT');
    setTxAmountRs('');
    setTxPaymentMethod('BANK_TRANSFER');
    setTxReference('');
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxNotes('');
    setTxError(null);
    setShowTxModal(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txStakeholderId) {
      setTxError('Please select a stakeholder');
      return;
    }
    const amountMinor = Math.round(parseFloat(txAmountRs || '0') * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setTxError('Please enter a valid amount greater than zero');
      return;
    }

    setSavingTx(true);
    setTxError(null);

    try {
      const input: CreateStakeholderTxInput = {
        stakeholderId: Number(txStakeholderId),
        type: txType,
        amountMinorUnits: amountMinor,
        paymentMethod: txPaymentMethod,
        reference: txReference.trim() || undefined,
        notes: txNotes.trim() || undefined,
        txnDate: txDate,
      };

      const res = await window.bakery.stakeholders.createTransaction(input);
      if (res.success) {
        showToast(`Transaction ${res.data.txnNumber} recorded successfully!`);
        setShowTxModal(false);
        await loadData();
      } else {
        setTxError(res.error?.message || 'Failed to record transaction');
      }
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : 'Error recording transaction');
    } finally {
      setSavingTx(false);
    }
  };

  // Handlers: Fiscal Period Create & Close
  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodLabel.trim() || !periodStartDate || !periodEndDate) {
      setPeriodError('Label, start date and end date are required');
      return;
    }

    setSavingPeriod(true);
    setPeriodError(null);

    try {
      const input: CreateFiscalPeriodInput = {
        label: periodLabel.trim(),
        startDate: periodStartDate,
        endDate: periodEndDate,
        notes: periodNotes.trim() || undefined,
      };

      const res = await window.bakery.stakeholders.createPeriod(input);
      if (res.success) {
        showToast(`Fiscal period "${res.data.label}" opened successfully!`);
        setShowPeriodModal(false);
        setPeriodLabel('');
        setPeriodStartDate('');
        setPeriodEndDate('');
        setPeriodNotes('');
        await loadData();
      } else {
        setPeriodError(res.error?.message || 'Failed to open fiscal period');
      }
    } catch (err: unknown) {
      setPeriodError(err instanceof Error ? err.message : 'Error opening fiscal period');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleClosePeriod = async (periodId: number) => {
    if (!window.confirm('Are you sure you want to lock and close this fiscal period?')) return;
    try {
      const res = await window.bakery.stakeholders.closePeriod({ periodId });
      if (res.success) {
        showToast(`Fiscal period closed and locked.`);
        await loadData();
      } else {
        alert(res.error?.message || 'Failed to close period');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error closing period');
    }
  };

  // Handlers: Calculate & Submit Profit Distribution Run
  const handlePreviewDistribution = async () => {
    if (!runPeriodId) {
      setRunError('Please select a fiscal period');
      return;
    }

    setCalculatingPreview(true);
    setRunError(null);

    try {
      const retentionBps = Math.round(parseFloat(runRetentionPercent || '0') * 100);
      const res = await window.bakery.stakeholders.calculateDistribution({
        periodId: Number(runPeriodId),
        retentionPercentBps: retentionBps,
      });

      if (res.success) {
        setPreviewCalculation(res.data);
      } else {
        setRunError(res.error?.message || 'Failed to calculate distribution preview');
      }
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : 'Error calculating distribution');
    } finally {
      setCalculatingPreview(false);
    }
  };

  const handleConfirmDistributionRun = async () => {
    if (!runPeriodId) return;

    setSubmittingRun(true);
    setRunError(null);

    try {
      const retentionBps = Math.round(parseFloat(runRetentionPercent || '0') * 100);
      const res = await window.bakery.stakeholders.createDistributionRun({
        periodId: Number(runPeriodId),
        retentionPercentBps: retentionBps,
        notes: runNotes.trim() || undefined,
      });

      if (res.success) {
        showToast(`Distribution run ${res.data.runNumber} generated in DRAFT state!`);
        setShowRunModal(false);
        setPreviewCalculation(null);
        await loadData();
      } else {
        setRunError(res.error?.message || 'Failed to create distribution run');
      }
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : 'Error creating distribution run');
    } finally {
      setSubmittingRun(false);
    }
  };

  const handleApproveRun = async (runId: number) => {
    if (!window.confirm('Approve this profit distribution run for disbursement?')) return;
    try {
      const res = await window.bakery.stakeholders.approveDistributionRun({ runId });
      if (res.success) {
        showToast(`Distribution run ${res.data.runNumber} APPROVED!`);
        await loadData();
      } else {
        alert(res.error?.message || 'Failed to approve run');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error approving run');
    }
  };

  const handlePayoutRun = async (runId: number) => {
    if (
      !window.confirm(
        'Disburse and payout this distribution? This creates immutable PROFIT_DISTRIBUTION entries in each stakeholder capital ledger.',
      )
    )
      return;

    try {
      const res = await window.bakery.stakeholders.payoutDistributionRun({
        runId,
        paymentMethod: 'BANK_TRANSFER',
      });
      if (res.success) {
        showToast(`Profit distribution ${res.data.runNumber} PAID and disbursed!`);
        await loadData();
      } else {
        alert(res.error?.message || 'Failed to payout distribution');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error paying out distribution');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Top Header & Subtab Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            }}
          >
            🤝
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
              Stakeholders &amp; Equity Management
            </h2>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Partner Capital Ratios, Immutable Ledger, Fiscal Period Close &amp; Profit Sharing Runs
            </p>
          </div>
        </div>

        {/* Action Buttons & Subtabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab('stakeholders')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '5px',
                border: 'none',
                background: activeSubTab === 'stakeholders' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'stakeholders' ? '#0369a1' : '#64748b',
                boxShadow: activeSubTab === 'stakeholders' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>👥</span> Partners &amp; Ratios
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('ledger')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '5px',
                border: 'none',
                background: activeSubTab === 'ledger' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'ledger' ? '#0369a1' : '#64748b',
                boxShadow: activeSubTab === 'ledger' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>📖</span> Capital Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('distributions')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '5px',
                border: 'none',
                background: activeSubTab === 'distributions' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'distributions' ? '#0369a1' : '#64748b',
                boxShadow: activeSubTab === 'distributions' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>💰</span> Profit Distributions
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('pnl')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '5px',
                border: 'none',
                background: activeSubTab === 'pnl' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'pnl' ? '#0369a1' : '#64748b',
                boxShadow: activeSubTab === 'pnl' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>📈</span> Company P&amp;L
            </button>
          </div>

          {activeSubTab === 'stakeholders' && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowAddModal(true);
                setAddError(null);
              }}
              style={{
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              }}
            >
              <span>+</span> Register Partner
            </button>
          )}

          {activeSubTab === 'ledger' && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleOpenTxModal()}
              style={{
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #059669, #047857)',
              }}
            >
              <span>+</span> Record Capital / Drawings
            </button>
          )}

          {activeSubTab === 'distributions' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPeriodModal(true);
                  setPeriodError(null);
                }}
                style={{
                  padding: '6px 12px',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>📅</span> Open Period
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setRunPeriodId(periods[0]?.id || '');
                  setPreviewCalculation(null);
                  setRunError(null);
                  setShowRunModal(true);
                }}
                style={{
                  padding: '6px 14px',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                }}
              >
                <span>⚡</span> Run Distribution
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sleek Compact KPI Bar (Space Efficient, Low Vertical Padding) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        <div
          style={{
            padding: '6px 12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Total Capital Balance
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0369a1', marginTop: '1px' }}>
              Rs. {totalCapitalInvestedRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ fontSize: '18px', opacity: 0.85 }}>💼</div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Net Distributable Profit
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: netCompanyProfitRs >= 0 ? '#059669' : '#dc2626',
                marginTop: '1px',
              }}
            >
              Rs. {netCompanyProfitRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ fontSize: '18px', opacity: 0.85 }}>📊</div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Total Partner Drawings
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#d97706', marginTop: '1px' }}>
              Rs. {totalDrawingsRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ fontSize: '18px', opacity: 0.85 }}>📉</div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Active Stakeholders
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
              {activePartnersCount} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>partners</span>
            </div>
          </div>
          <div style={{ fontSize: '18px', opacity: 0.85 }}>👥</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: '#ecfdf5',
            color: '#065f46',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #a7f3d0',
          }}
        >
          <span>✅</span> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #fecaca',
          }}
        >
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: STAKEHOLDERS & EQUITY RATIOS                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'stakeholders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Search & Filters Bar */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              background: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <input
                type="text"
                placeholder="Search by code, partner name, phone or CNIC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 9px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Types</option>
                <option value="OWNER">Owner</option>
                <option value="PARTNER">Partner</option>
                <option value="INVESTOR">Investor</option>
                <option value="SILENT_PARTNER">Silent Partner</option>
              </select>
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="EXITED">Exited</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px' }}>Code</th>
                  <th style={{ padding: '6px 10px' }}>Partner Name</th>
                  <th style={{ padding: '6px 10px' }}>Type</th>
                  <th style={{ padding: '6px 10px' }}>Share Mode</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Profit Share</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Capital Balance</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Drawings</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Distributions</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStakeholders.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      {loading ? 'Loading stakeholders...' : 'No stakeholders found matching the criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredStakeholders.map((s) => {
                    const capitalRs = (s.capitalBalanceMinorUnits || 0) / 100;
                    const drawingsRs = (s.totalDrawingsMinorUnits || 0) / 100;
                    const distRs = (s.totalDistributionsMinorUnits || 0) / 100;
                    const profitPercent = ((s.currentEquity?.profitShareBps || 0) / 100).toFixed(2);
                    const mode = s.currentEquity?.shareMode || 'FIXED_PERCENT';

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0369a1' }}>{s.code}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.fullName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {s.phone ? `📞 ${s.phone}` : ''} {s.cnicOrTaxId ? `| CNIC: ${s.cnicOrTaxId}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background:
                                s.stakeholderType === 'OWNER'
                                  ? '#ede9fe'
                                  : s.stakeholderType === 'PARTNER'
                                    ? '#e0f2fe'
                                    : s.stakeholderType === 'INVESTOR'
                                      ? '#fef3c7'
                                      : '#f1f5f9',
                              color:
                                s.stakeholderType === 'OWNER'
                                  ? '#6d28d9'
                                  : s.stakeholderType === 'PARTNER'
                                    ? '#0369a1'
                                    : s.stakeholderType === 'INVESTOR'
                                      ? '#b45309'
                                      : '#475569',
                            }}
                          >
                            {s.stakeholderType}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: mode === 'FIXED_PERCENT' ? '#334155' : '#0891b2',
                            }}
                          >
                            {mode === 'FIXED_PERCENT' ? 'Fixed %' : 'Capital Proportional'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {mode === 'FIXED_PERCENT' ? `${profitPercent}%` : 'Auto (Capital)'}
                        </td>
                        <td
                          style={{
                            padding: '6px 10px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: capitalRs >= 0 ? '#0369a1' : '#dc2626',
                          }}
                        >
                          Rs. {capitalRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                          Rs. {drawingsRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                          Rs. {distRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: s.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                              color: s.status === 'ACTIVE' ? '#065f46' : '#991b1b',
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEquityModal(s)}
                              title="Update Equity Ratios"
                              style={{
                                padding: '3px 7px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                cursor: 'pointer',
                              }}
                            >
                              ⚖️ Ratios
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTxModal(s.id)}
                              title="Record Capital Investment or Drawings"
                              style={{
                                padding: '3px 7px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                cursor: 'pointer',
                              }}
                            >
                              💳 Tx
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: CAPITAL & DRAWINGS LEDGER                                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Search & Filters */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              background: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', marginRight: '6px', fontWeight: 600 }}>Partner:</label>
              <select
                value={ledgerStakeholderFilter}
                onChange={(e) => setLedgerStakeholderFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Stakeholders</option>
                {stakeholders.map((s) => (
                  <option key={s.id} value={s.id.toString()}>
                    {s.code} - {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', marginRight: '6px', fontWeight: 600 }}>Type:</label>
              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Transactions</option>
                <option value="CAPITAL_INTRODUCED">Capital Introduced</option>
                <option value="ADDITIONAL_INVESTMENT">Additional Investment</option>
                <option value="DRAWINGS">Drawings</option>
                <option value="PROFIT_DISTRIBUTION">Profit Distribution</option>
                <option value="CAPITAL_WITHDRAWAL">Capital Withdrawal</option>
                <option value="LOAN_IN">Loan In</option>
                <option value="LOAN_REPAYMENT">Loan Repayment</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px' }}>Date</th>
                  <th style={{ padding: '6px 10px' }}>Tx #</th>
                  <th style={{ padding: '6px 10px' }}>Partner</th>
                  <th style={{ padding: '6px 10px' }}>Type</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 10px' }}>Method</th>
                  <th style={{ padding: '6px 10px' }}>Reference &amp; Notes</th>
                  <th style={{ padding: '6px 10px' }}>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      No capital transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const amountRs = t.amountMinorUnits / 100;
                    const isCredit =
                      t.type === 'CAPITAL_INTRODUCED' ||
                      t.type === 'ADDITIONAL_INVESTMENT' ||
                      t.type === 'LOAN_IN';
                    const isDebit =
                      t.type === 'CAPITAL_WITHDRAWAL' || t.type === 'DRAWINGS' || t.type === 'LOAN_REPAYMENT';

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', color: '#475569' }}>{t.txnDate}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a' }}>{t.txnNumber}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{t.stakeholderName}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: isCredit
                                ? '#ecfdf5'
                                : t.type === 'DRAWINGS'
                                  ? '#fef3c7'
                                  : isDebit
                                    ? '#fef2f2'
                                    : '#eff6ff',
                              color: isCredit
                                ? '#065f46'
                                : t.type === 'DRAWINGS'
                                  ? '#b45309'
                                  : isDebit
                                    ? '#991b1b'
                                    : '#1e40af',
                            }}
                          >
                            {t.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '6px 10px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isCredit ? '#059669' : isDebit ? '#dc2626' : '#0f172a',
                          }}
                        >
                          {isCredit ? '+' : isDebit ? '-' : ''} Rs.{' '}
                          {amountRs.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#64748b' }}>{t.paymentMethod}</td>
                        <td style={{ padding: '6px 10px', fontSize: '11px', color: '#475569' }}>
                          {t.reference ? <span style={{ fontWeight: 600 }}>{t.reference} </span> : null}
                          {t.notes ? `(${t.notes})` : ''}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '11px' }}>{t.createdBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: PROFIT DISTRIBUTIONS & FISCAL PERIODS                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'distributions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Active Fiscal Periods Section */}
          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                📅 Fiscal Periods
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Periods isolate financial cycles for auditable distribution runs
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '5px 8px' }}>Period Code</th>
                    <th style={{ padding: '5px 8px' }}>Label</th>
                    <th style={{ padding: '5px 8px' }}>Date Range</th>
                    <th style={{ padding: '5px 8px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '5px 8px' }}>Closed By</th>
                    <th style={{ padding: '5px 8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                        No fiscal periods created yet. Click "Open Period" above.
                      </td>
                    </tr>
                  ) : (
                    periods.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 700, color: '#0369a1' }}>{p.periodCode}</td>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{p.label}</td>
                        <td style={{ padding: '5px 8px', color: '#475569' }}>
                          {p.startDate} → {p.endDate}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: p.status === 'OPEN' ? '#ecfdf5' : '#f1f5f9',
                              color: p.status === 'OPEN' ? '#065f46' : '#64748b',
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: '11px', color: '#64748b' }}>
                          {p.closedBy ? `${p.closedBy} (${p.closedAtUtc?.slice(0, 10)})` : '—'}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          {p.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => handleClosePeriod(p.id)}
                              style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '3px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                            >
                              Lock &amp; Close
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Distribution Runs Section */}
          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                ⚡ Profit Distribution Runs
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Automated P&amp;L reconciliation and stakeholder dividend vouchers
              </span>
            </div>

            {distributionRuns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>
                No profit distribution runs yet. Click "Run Distribution" above to generate.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {distributionRuns.map((r) => {
                  const netProfitRs = r.netProfitMinorUnits / 100;
                  const distRs = r.distributableProfitMinorUnits / 100;
                  const retainedRs = r.retainedEarningsMinorUnits / 100;

                  return (
                    <div
                      key={r.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '10px',
                        background: '#fafafa',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                          borderBottom: '1px solid #e2e8f0',
                          paddingBottom: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                            {r.runNumber}
                          </span>
                          <span style={{ fontSize: '11px', color: '#475569' }}>({r.periodLabel})</span>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background:
                                r.status === 'PAID'
                                  ? '#ecfdf5'
                                  : r.status === 'APPROVED'
                                    ? '#eff6ff'
                                    : '#fef3c7',
                              color:
                                r.status === 'PAID'
                                  ? '#065f46'
                                  : r.status === 'APPROVED'
                                    ? '#1d4ed8'
                                    : '#b45309',
                            }}
                          >
                            {r.status}
                          </span>
                        </div>

                        {/* Actions for this run */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {r.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleApproveRun(r.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: 'none',
                                background: '#3b82f6',
                                color: '#ffffff',
                                cursor: 'pointer',
                              }}
                            >
                              Approve Run
                            </button>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handlePayoutRun(r.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: 'none',
                                background: '#10b981',
                                color: '#ffffff',
                                cursor: 'pointer',
                              }}
                            >
                              Disburse &amp; Payout
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Run Metrics Summary */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '6px',
                          margin: '8px 0',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Revenue: </span>
                          <strong style={{ color: '#0f172a' }}>Rs. {(r.revenueMinorUnits / 100).toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>COGS: </span>
                          <strong style={{ color: '#dc2626' }}>Rs. {(r.cogsMinorUnits / 100).toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Expenses + Staff: </span>
                          <strong style={{ color: '#dc2626' }}>
                            Rs. {((r.operatingExpensesMinorUnits + r.staffCostMinorUnits) / 100).toFixed(2)}
                          </strong>
                        </div>
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Net Profit: </span>
                          <strong style={{ color: netProfitRs >= 0 ? '#059669' : '#dc2626' }}>
                            Rs. {netProfitRs.toFixed(2)}
                          </strong>
                        </div>
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Distributable: </span>
                          <strong style={{ color: '#0284c7' }}>Rs. {distRs.toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Retained: </span>
                          <strong style={{ color: '#7c3aed' }}>Rs. {retainedRs.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* Partner Lines Table */}
                      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '6px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                            <th style={{ padding: '4px 8px' }}>Partner</th>
                            <th style={{ padding: '4px 8px' }}>Share Mode</th>
                            <th style={{ padding: '4px 8px', textAlign: 'center' }}>Share %</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Capital Balance</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Allocated Share</th>
                            <th style={{ padding: '4px 8px', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.lines || []).map((line) => (
                            <tr key={line.id || line.stakeholderId} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{line.stakeholderName}</td>
                              <td style={{ padding: '4px 8px', color: '#64748b' }}>{line.shareMode}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>
                                {(line.shareBps / 100).toFixed(2)}%
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569' }}>
                                Rs. {(line.capitalBalanceMinorUnits / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                Rs. {(line.allocatedAmountMinorUnits / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    background: line.status === 'PAID' ? '#ecfdf5' : '#fef3c7',
                                    color: line.status === 'PAID' ? '#065f46' : '#b45309',
                                  }}
                                >
                                  {line.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: EXECUTIVE COMPANY P&L STATEMENT                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'pnl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
              📊 Company Profit &amp; Loss Statement (Ledger Reconciled)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '650px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Gross Sales Revenue</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  Rs. {((pnlSummary?.grossSalesMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#dc2626' }}>Less: Sales Returns &amp; Customer Credit Notes</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>
                  - Rs. {((pnlSummary?.salesReturnsMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                <span>= Net Commercial Revenue</span>
                <span style={{ color: '#0369a1' }}>
                  Rs. {((pnlSummary?.netRevenueMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#dc2626' }}>Less: Cost of Goods Sold (COGS)</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>
                  - Rs. {((pnlSummary?.cogsMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #cbd5e1',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                <span>= Gross Profit</span>
                <span style={{ color: '#059669' }}>
                  Rs. {((pnlSummary?.grossProfitMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#dc2626' }}>Less: General &amp; Administrative Operating Expenses</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>
                  - Rs. {((pnlSummary?.operatingExpensesMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#dc2626' }}>Less: Staff Salaries &amp; Payroll Cost (shown separately)</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>
                  - Rs. {((pnlSummary?.staffCostMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '2px solid #0f172a',
                  fontWeight: 800,
                  fontSize: '14px',
                  marginTop: '8px',
                }}
              >
                <span>= Net Company Profit for Period</span>
                <span
                  style={{
                    color: (pnlSummary?.netProfitMinorUnits || 0) >= 0 ? '#059669' : '#dc2626',
                  }}
                >
                  Rs. {((pnlSummary?.netProfitMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                * Note: Partner profit distributions and drawings are appropriations of profit and do not reduce P&amp;L.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER STAKEHOLDER                                               */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '540px' }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>👥</span>
              <span>Register Stakeholder / Partner</span>
            </h3>

            {addError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleSaveStakeholder} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    placeholder="e.g. Haji Muhammad Tariq"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Type</label>
                  <select
                    value={addType}
                    onChange={(e: any) => setAddType(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="OWNER">Owner</option>
                    <option value="PARTNER">Managing Partner</option>
                    <option value="INVESTOR">Working Investor</option>
                    <option value="SILENT_PARTNER">Silent Partner</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>CNIC / Tax ID</label>
                  <input
                    type="text"
                    value={addCnic}
                    onChange={(e) => setAddCnic(e.target.value)}
                    placeholder="35202-xxxxxxx-x"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Phone</label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="0300-xxxxxxx"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Joined Date</label>
                  <input
                    type="date"
                    required
                    value={addJoinedDate}
                    onChange={(e) => setAddJoinedDate(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Profit Share Mode</label>
                  <select
                    value={addShareMode}
                    onChange={(e: any) => setAddShareMode(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="FIXED_PERCENT">Fixed Percentage (%)</option>
                    <option value="CAPITAL_PROPORTIONAL">Capital Proportional (Auto)</option>
                  </select>
                </div>
              </div>

              {addShareMode === 'FIXED_PERCENT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Ownership %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addOwnershipPercent}
                      onChange={(e) => setAddOwnershipPercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Profit Share %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addProfitSharePercent}
                      onChange={(e) => setAddProfitSharePercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Loss Share %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addLossSharePercent}
                      onChange={(e) => setAddLossSharePercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Initial Capital Injection (Rs.)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={addInitialCapitalRs}
                    onChange={(e) => setAddInitialCapitalRs(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Payment Method</label>
                  <select
                    value={addPaymentMethod}
                    onChange={(e: any) => setAddPaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash Deposit</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Notes / Agreement Reference</label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="e.g. Partnership deed registered on 15 Oct 2026"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={savingStakeholder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingStakeholder}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                >
                  {savingStakeholder ? 'Saving...' : 'Register Stakeholder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPDATE EQUITY RATIOS                                               */}
      {/* ========================================================================= */}
      {showEquityModal && equityTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>⚖️</span>
              <span>Update Equity Ratios — {equityTarget.fullName}</span>
            </h3>

            {equityError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                {equityError}
              </div>
            )}

            <form onSubmit={handleSaveEquity} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Share Mode</label>
                <select
                  value={equityShareMode}
                  onChange={(e: any) => setEquityShareMode(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="FIXED_PERCENT">Fixed Percentage (%)</option>
                  <option value="CAPITAL_PROPORTIONAL">Capital Proportional (Auto)</option>
                </select>
              </div>

              {equityShareMode === 'FIXED_PERCENT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Ownership %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={equityOwnershipPercent}
                      onChange={(e) => setEquityOwnershipPercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Profit Share %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={equityProfitPercent}
                      onChange={(e) => setEquityProfitPercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Loss Share %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={equityLossPercent}
                      onChange={(e) => setEquityLossPercent(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Effective Date</label>
                <input
                  type="date"
                  required
                  value={equityEffectiveDate}
                  onChange={(e) => setEquityEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Reason / Notes</label>
                <input
                  type="text"
                  value={equityNotes}
                  onChange={(e) => setEquityNotes(e.target.value)}
                  placeholder="e.g. Capital restructuring amendment"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEquityModal(false)}
                  disabled={savingEquity}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingEquity}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                >
                  {savingEquity ? 'Saving...' : 'Save Ratio Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD CAPITAL / DRAWINGS TRANSACTION                              */}
      {/* ========================================================================= */}
      {showTxModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>💳</span>
              <span>Record Capital / Drawings Transaction</span>
            </h3>

            {txError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                {txError}
              </div>
            )}

            <form onSubmit={handleSaveTx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Partner / Stakeholder *</label>
                <select
                  required
                  value={txStakeholderId}
                  onChange={(e) => setTxStakeholderId(Number(e.target.value))}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Select Partner</option>
                  {stakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.fullName} ({s.stakeholderType})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Transaction Type</label>
                  <select
                    value={txType}
                    onChange={(e: any) => setTxType(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="ADDITIONAL_INVESTMENT">Additional Investment (+)</option>
                    <option value="DRAWINGS">Partner Drawings (-)</option>
                    <option value="CAPITAL_WITHDRAWAL">Capital Withdrawal (-)</option>
                    <option value="LOAN_IN">Partner Loan In (+)</option>
                    <option value="LOAN_REPAYMENT">Loan Repayment (-)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={txAmountRs}
                    onChange={(e) => setTxAmountRs(e.target.value)}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Payment Method</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e: any) => setTxPaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Reference / Cheque #</label>
                <input
                  type="text"
                  value={txReference}
                  onChange={(e) => setTxReference(e.target.value)}
                  placeholder="e.g. HBL Online Tx / Cheque #492812"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Notes</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="e.g. Monthly personal drawings"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTxModal(false)}
                  disabled={savingTx}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingTx}
                  style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                >
                  {savingTx ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OPEN FISCAL PERIOD                                                 */}
      {/* ========================================================================= */}
      {showPeriodModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>📅</span>
              <span>Open New Fiscal Period</span>
            </h3>

            {periodError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                {periodError}
              </div>
            )}

            <form onSubmit={handleSavePeriod} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Period Label *</label>
                <input
                  type="text"
                  required
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="e.g. October 2026 / Q4 2026"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>End Date *</label>
                  <input
                    type="date"
                    required
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Notes</label>
                <input
                  type="text"
                  value={periodNotes}
                  onChange={(e) => setPeriodNotes(e.target.value)}
                  placeholder="Optional period notes"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPeriodModal(false)}
                  disabled={savingPeriod}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingPeriod}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                >
                  {savingPeriod ? 'Opening...' : 'Open Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CALCULATE & RUN PROFIT DISTRIBUTION                                */}
      {/* ========================================================================= */}
      {showRunModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '640px' }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>⚡</span>
              <span>Calculate &amp; Run Profit Distribution</span>
            </h3>

            {runError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                {runError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Select Fiscal Period *</label>
                  <select
                    value={runPeriodId}
                    onChange={(e) => {
                      setRunPeriodId(Number(e.target.value));
                      setPreviewCalculation(null);
                    }}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Select Period</option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.startDate} → {p.endDate}) [{p.status}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155' }}>Retain in Reserve (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={runRetentionPercent}
                    onChange={(e) => {
                      setRunRetentionPercent(e.target.value);
                      setPreviewCalculation(null);
                    }}
                    placeholder="0"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePreviewDistribution}
                  disabled={calculatingPreview || !runPeriodId}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <span>🔍</span> {calculatingPreview ? 'Reconciling Ledger...' : 'Calculate Live P&L Preview'}
                </button>
              </div>

              {/* Preview Details */}
              {previewCalculation && (
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Revenue: </span>
                      <strong>Rs. {(previewCalculation.revenueMinorUnits / 100).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>COGS: </span>
                      <strong style={{ color: '#dc2626' }}>Rs. {(previewCalculation.cogsMinorUnits / 100).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Opex + Staff: </span>
                      <strong style={{ color: '#dc2626' }}>
                        Rs. {((previewCalculation.operatingExpensesMinorUnits + previewCalculation.staffCostMinorUnits) / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Net Profit: </span>
                      <strong style={{ color: previewCalculation.netProfitMinorUnits >= 0 ? '#059669' : '#dc2626' }}>
                        Rs. {(previewCalculation.netProfitMinorUnits / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Distributable: </span>
                      <strong style={{ color: '#0284c7' }}>
                        Rs. {(previewCalculation.distributableProfitMinorUnits / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Retained Reserve: </span>
                      <strong style={{ color: '#7c3aed' }}>
                        Rs. {(previewCalculation.retainedEarningsMinorUnits / 100).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* Partner Share Breakdown Preview */}
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px' }}>Partner</th>
                        <th style={{ padding: '4px 6px' }}>Mode</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' }}>Share %</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Capital</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Calculated Dividend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewCalculation.lines || []).map((l) => (
                        <tr key={l.stakeholderId} style={{ borderBottom: '1px solid #edf2f7' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600 }}>{l.stakeholderName}</td>
                          <td style={{ padding: '4px 6px', color: '#64748b' }}>{l.shareMode}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}>
                            {(l.shareBps / 100).toFixed(2)}%
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: '#475569' }}>
                            Rs. {(l.capitalBalanceMinorUnits / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            Rs. {(l.allocatedAmountMinorUnits / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <label style={{ fontWeight: 700, color: '#334155' }}>Run Notes / Resolution</label>
                <input
                  type="text"
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="e.g. Approved at Board Meeting on 15 Oct"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRunModal(false)}
                  disabled={submittingRun}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmDistributionRun}
                  disabled={submittingRun || !previewCalculation}
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                >
                  {submittingRun ? 'Creating Run...' : 'Confirm & Create Distribution Run'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
