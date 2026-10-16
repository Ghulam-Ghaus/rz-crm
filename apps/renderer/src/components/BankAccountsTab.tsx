import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CompanyBankAccount,
  BankTransaction,
  BankSummaryStats,
} from '@rz-crm/contracts';
import { compressImageToWebP, formatBytes, CompressionResult } from '../utils/image-compression';
import { useToast } from '../context/ToastContext';
import { AttachmentViewerModal } from './AttachmentViewerModal';

export const BankAccountsTab: React.FC = () => {
  const toast = useToast();

  // State
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [stats, setStats] = useState<BankSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddAccountOpen, setIsAddAccountOpen] = useState<boolean>(false);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [viewingAttachmentPath, setViewingAttachmentPath] = useState<string | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState<string>('Attachment Preview');

  // Form states: Add Account
  const [newBankName, setNewBankName] = useState<string>('');
  const [newAccountTitle, setNewAccountTitle] = useState<string>('');
  const [newAccountNumber, setNewAccountNumber] = useState<string>('');
  const [newIban, setNewIban] = useState<string>('');
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>('0');
  const [submittingAccount, setSubmittingAccount] = useState<boolean>(false);

  // Form states: Deposit Cash
  const [depositAccountId, setDepositAccountId] = useState<number | ''>('');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositSlipNumber, setDepositSlipNumber] = useState<string>('');
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [depositPhoto, setDepositPhoto] = useState<CompressionResult | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState<boolean>(false);
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [accsRes, statsRes, txsRes] = await Promise.all([
        window.bakery.bank.listAccounts(1),
        window.bakery.bank.getSummaryStats(1),
        window.bakery.bank.listTransactions({
          storeId: 1,
          limit: 150,
          bankAccountId: selectedAccountId === 'ALL' ? undefined : selectedAccountId,
        }),
      ]);

      if (accsRes.success && accsRes.data) {
        setAccounts(accsRes.data);
        if (depositAccountId === '' && accsRes.data.length > 0) {
          setDepositAccountId(accsRes.data[0].id);
        }
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (txsRes.success && txsRes.data) setTransactions(txsRes.data);
    } catch (err: any) {
      toast.error(err.message, 'Failed to load bank data');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, depositAccountId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Bank Account Handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newAccountTitle.trim() || !newAccountNumber.trim()) {
      toast.warning('Bank name, title, and account number are required.', 'Required Fields');
      return;
    }

    try {
      setSubmittingAccount(true);
      const openMinor = Math.round(parseFloat(newOpeningBalance || '0') * 100);

      const res = await window.bakery.bank.createAccount({
        storeId: 1,
        bankName: newBankName.trim(),
        accountTitle: newAccountTitle.trim(),
        accountNumber: newAccountNumber.trim(),
        iban: newIban.trim() || undefined,
        branchName: newBranchName.trim() || undefined,
        openingBalanceMinorUnits: openMinor,
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create bank account');
      }

      toast.success(`Account ${newBankName} (${newAccountNumber}) registered successfully.`, 'Bank Account Added');

      setIsAddAccountOpen(false);
      setNewBankName('');
      setNewAccountTitle('');
      setNewAccountNumber('');
      setNewIban('');
      setNewBranchName('');
      setNewOpeningBalance('0');
      fetchData();
    } catch (err: any) {
      toast.error(err.message, 'Error Creating Account');
    } finally {
      setSubmittingAccount(false);
    }
  };

  // Deposit Photo Picker
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingPhoto(true);
      const result = await compressImageToWebP(file, 1280, 0.82);
      setDepositPhoto(result);
    } catch (err: any) {
      toast.error(err.message || 'Unable to compress slip photo', 'Image Compression Failed');
    } finally {
      setCompressingPhoto(false);
    }
  };

  // Cash to Bank Deposit Handler
  const handleDepositCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(depositAmount || '0');
    if (!depositAccountId || amountVal <= 0) {
      toast.warning('Please enter a valid deposit amount.', 'Invalid Amount');
      return;
    }

    try {
      setSubmittingDeposit(true);
      let savedAttachmentPath: string | undefined = undefined;

      if (depositPhoto) {
        const attachRes = await window.bakery.attachments.save({
          folder: 'slips',
          filenamePrefix: `slip_dep_${depositAccountId}`,
          base64Data: depositPhoto.base64Data,
        });

        if (!attachRes.success) {
          throw new Error(attachRes.error?.message || 'Failed to save slip photo');
        }
        savedAttachmentPath = attachRes.data?.relativePath;
      }

      const depRes = await window.bakery.bank.depositCash({
        storeId: 1,
        bankAccountId: Number(depositAccountId),
        amountMinorUnits: Math.round(amountVal * 100),
        depositSlipNumber: depositSlipNumber.trim() || undefined,
        notes: depositNotes.trim() || undefined,
        attachmentPath: savedAttachmentPath,
        depositDateUtc: depositDate ? `${depositDate}T12:00:00Z` : undefined,
      });

      if (!depRes.success) {
        throw new Error(depRes.error?.message || 'Failed to record deposit');
      }

      toast.success(`Rs. ${amountVal.toLocaleString()} deposited successfully into bank account.`, 'Cash Deposit Recorded');

      setIsDepositOpen(false);
      setDepositAmount('');
      setDepositSlipNumber('');
      setDepositNotes('');
      setDepositPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
    } catch (err: any) {
      toast.error(err.message, 'Deposit Error');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // Filtered Transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== 'ALL' && tx.txnType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = tx.reference?.toLowerCase().includes(q);
      const matchBank = tx.bankName?.toLowerCase().includes(q);
      const matchNotes = tx.notes?.toLowerCase().includes(q);
      const matchType = tx.txnType.toLowerCase().includes(q);
      if (!matchRef && !matchBank && !matchNotes && !matchType) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏦</span> Company Bank Accounts & Cheque Clearing
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Manage company bank accounts, cash drawer deposits, and physical cheque clearing with WebP attachments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              color: '#334155',
              opacity: loading ? 0.7 : 1,
            }}
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => setIsDepositOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#16a34a',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            💵 Deposit Cash to Bank
          </button>

          <button
            type="button"
            onClick={() => setIsAddAccountOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            + Add Bank Account
          </button>
        </div>
      </div>

      {/* KPI Cards (Tight compact vertical padding: '6px 12px' per strict user invariant) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '10px',
        }}
      >
        {/* Total Bank Balance */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px', fontSize: '18px' }}>
            🏛️
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, display: 'block' }}>Total Bank Balance</span>
            <strong style={{ fontSize: '16px', color: '#0f172a' }}>
              Rs. {((stats?.totalBankBalanceMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* Active Accounts */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '8px', fontSize: '18px' }}>
            🏢
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, display: 'block' }}>Active Bank Accounts</span>
            <strong style={{ fontSize: '16px', color: '#0f172a' }}>
              {stats?.activeAccountsCount || accounts.length} Accounts
            </strong>
          </div>
        </div>

        {/* Pending Inward Cheques */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: '#ecfdf5', padding: '8px', borderRadius: '8px', fontSize: '18px' }}>
            📥
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Pending Inward Cheques ({stats?.pendingInwardChequesCount || 0})
            </span>
            <strong style={{ fontSize: '16px', color: '#059669' }}>
              Rs. {((stats?.pendingInwardChequesMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* Pending Outward Cheques */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: '#fff7ed', padding: '8px', borderRadius: '8px', fontSize: '18px' }}>
            📤
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Pending Outward Cheques ({stats?.pendingOutwardChequesCount || 0})
            </span>
            <strong style={{ fontSize: '16px', color: '#ea580c' }}>
              Rs. {((stats?.pendingOutwardChequesMinorUnits || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* Company Bank Accounts Table Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
            🏢 Registered Company Bank Accounts ({accounts.length})
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>All figures in PKR Paisas (Strict integer minor units)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Bank Name</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Account Title</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Account Number</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Branch / IBAN</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Opening Balance</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Current Balance</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    No bank accounts configured yet. Click "+ Add Bank Account" above to register your first account.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                      {acc.bankName}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>{acc.accountTitle}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#0f172a' }}>
                      {acc.accountNumber}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>
                      {acc.branchName || acc.iban ? `${acc.branchName || ''} ${acc.iban ? `(${acc.iban})` : ''}` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                      Rs. {(acc.openingBalanceMinorUnits / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: acc.currentBalanceMinorUnits >= 0 ? '#16a34a' : '#dc2626',
                      }}
                    >
                      Rs. {(acc.currentBalanceMinorUnits / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: acc.isActive ? '#ecfdf5' : '#f1f5f9',
                          color: acc.isActive ? '#059669' : '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDepositAccountId(acc.id);
                          setIsDepositOpen(true);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid #16a34a',
                          backgroundColor: '#ecfdf5',
                          color: '#16a34a',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + Deposit Cash
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Transactions Ledger Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Ledger Header & Filters */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📄</span>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              Bank Statements Ledger ({filteredTransactions.length} entries)
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Account Selector */}
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Bank Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} ({a.accountNumber})
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Transaction Types</option>
              <option value="CASH_DEPOSIT">Cash Deposit</option>
              <option value="CHEQUE_CLEAR">Cheque Clearing</option>
              <option value="OPENING">Opening Balance</option>
              <option value="WITHDRAWAL">Withdrawal</option>
            </select>

            {/* Search Input */}
            <input
              type="text"
              placeholder="🔍 Search ref, slip, cheque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                width: '180px',
              }}
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Date (UTC)</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Bank Account</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Transaction Type</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Reference / Cheque #</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Notes / Description</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Running Balance</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>Photo Slip</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    No bank transactions recorded yet.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {tx.createdAtUtc ? tx.createdAtUtc.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#0f172a' }}>
                      {tx.bankName} <span style={{ color: '#64748b', fontSize: '11px' }}>({tx.accountNumber})</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          backgroundColor:
                            tx.txnType === 'CASH_DEPOSIT'
                              ? '#eff6ff'
                              : tx.txnType === 'CHEQUE_CLEAR'
                              ? '#f0fdf4'
                              : tx.txnType === 'OPENING'
                              ? '#fefce8'
                              : '#f1f5f9',
                          color:
                            tx.txnType === 'CASH_DEPOSIT'
                              ? '#2563eb'
                              : tx.txnType === 'CHEQUE_CLEAR'
                              ? '#16a34a'
                              : tx.txnType === 'OPENING'
                              ? '#ca8a04'
                              : '#475569',
                        }}
                      >
                        {tx.txnType}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#0f172a' }}>
                      {tx.reference || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569', maxWidth: '260px' }}>
                      {tx.notes || '-'}
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: tx.direction === 'INFLOW' ? '#16a34a' : '#dc2626',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tx.direction === 'INFLOW' ? '+' : '-'}Rs. {(tx.amountMinorUnits / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      Rs. {(tx.runningBalanceMinorUnits / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {tx.attachmentPath ? (
                        <button
                          type="button"
                          onClick={() => {
                            setViewingAttachmentPath(tx.attachmentPath!);
                            setAttachmentTitle(`Slip/Cheque Photo: ${tx.reference || tx.txnType}`);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          👁️ View Photo
                        </button>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Bank Account */}
      {isAddAccountOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsAddAccountOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '520px',
              maxWidth: '95vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Register New Company Bank Account
              </h3>
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bank Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank, HBL, Bank Alfalah, MCB"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Account Title <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. RZ Enterprises"
                  value={newAccountTitle}
                  onChange={(e) => setNewAccountTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Account Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 01020304050607"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    IBAN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="PK..."
                    value={newIban}
                    onChange={(e) => setNewIban(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Branch Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Boulevard Branch"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Opening Balance (PKR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Initial balance currently present in the account.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccount}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  {submittingAccount ? 'Saving...' : 'Save Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Deposit Cash to Bank */}
      {isDepositOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsDepositOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '560px',
              maxWidth: '95vw',
              maxHeight: '92vh',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f0fdf4',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💵</span> Deposit Counter Cash to Bank Account
              </h3>
              <button
                type="button"
                onClick={() => setIsDepositOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDepositCash} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Target Company Bank Account <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} - {a.accountTitle} ({a.accountNumber}) · Bal: Rs. {(a.currentBalanceMinorUnits / 100).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Deposit Amount (PKR) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 50000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Deposit Date
                  </label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bank Deposit Slip Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. SLIP-8921"
                  value={depositSlipNumber}
                  onChange={(e) => setDepositSlipNumber(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              {/* Deposit Slip Photo (Optimized WebP) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Physical Bank Deposit Slip Photo (Optimized WebP)
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />

                {!depositPhoto ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '14px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {compressingPhoto ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                        <span style={{ fontSize: '20px' }}>⏳</span>
                        <span style={{ fontSize: '12px' }}>Auto-compressing image...</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '22px' }}>📷</span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#0f172a' }}>
                          Upload Bank Stamped Deposit Slip Photo
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Auto-compressed to WebP (~80 KB)
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#ecfdf5',
                      borderRadius: '8px',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={depositPhoto.base64Data}
                        alt="Slip Preview"
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #10b981' }}
                      />
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#065f46' }}>
                          Slip Photo Compressed
                        </div>
                        <div style={{ fontSize: '10px', color: '#047857' }}>
                          {formatBytes(depositPhoto.originalSize)} ➔ {formatBytes(depositPhoto.compressedSize)} ({depositPhoto.compressionRatio}% saved)
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositPhoto(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{ padding: '4px 8px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Closing cash deposited by Manager"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setIsDepositOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDeposit}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  {submittingDeposit ? 'Recording...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Photo Lightbox Modal */}
      {viewingAttachmentPath && (
        <AttachmentViewerModal
          attachmentPath={viewingAttachmentPath}
          title={attachmentTitle}
          onClose={() => setViewingAttachmentPath(null)}
        />
      )}
    </div>
  );
};
