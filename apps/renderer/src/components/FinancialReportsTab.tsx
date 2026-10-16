import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ReceivablesAgeingReport,
  PayablesAgeingReport,
  ChequeRegisterReport,
  ChequeItem,
  StockValuationReport,
  StakeholderStatementReport,
  Stakeholder,
  Store,
} from '@rz-crm/contracts';
import { ClearChequeModal } from './ClearChequeModal';
import { AttachmentViewerModal } from './AttachmentViewerModal';

interface FinancialReportsTabProps {
  store: Store | null;
}

type FinancialSubTab =
  | 'receivables'
  | 'payables'
  | 'cheques'
  | 'stock-valuation'
  | 'stakeholder-statements';

function formatRs(minorUnits: number): string {
  const isNegative = minorUnits < 0;
  const absVal = Math.abs(minorUnits) / 100;
  const formatted = absVal.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}Rs. ${formatted}`;
}

export const FinancialReportsTab: React.FC<FinancialReportsTabProps> = ({ store }) => {
  const storeId = store?.id || 1;

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<FinancialSubTab>('receivables');

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Report Data States
  const [receivablesReport, setReceivablesReport] = useState<ReceivablesAgeingReport | null>(null);
  const [payablesReport, setPayablesReport] = useState<PayablesAgeingReport | null>(null);
  const [chequeReport, setChequeReport] = useState<ChequeRegisterReport | null>(null);
  const [stockValReport, setStockValReport] = useState<StockValuationReport | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<number | null>(null);
  const [stakeholderStatement, setStakeholderStatement] = useState<StakeholderStatementReport | null>(null);

  // Filters
  const [receivablesSearch, setReceivablesSearch] = useState<string>('');
  const [payablesSearch, setPayablesSearch] = useState<string>('');
  const [chequeSearch, setChequeSearch] = useState<string>('');
  const [chequeDirectionFilter, setChequeDirectionFilter] = useState<'ALL' | 'INWARD_CUSTOMER' | 'OUTWARD_SUPPLIER'>('ALL');
  const [chequeMaturityFilter, setChequeMaturityFilter] = useState<'ALL' | 'OVERDUE' | '7DAYS' | '30DAYS' | 'CLEARED'>('ALL');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [selectedStockCategory, setSelectedStockCategory] = useState<string>('ALL');

  // Cheque Clearing & Photo Attachment Modals
  const [selectedChequeForClearing, setSelectedChequeForClearing] = useState<ChequeItem | null>(null);
  const [viewingAttachmentPath, setViewingAttachmentPath] = useState<string | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState<string>('Attachment Preview');

  // Fetch Reports
  const loadReceivables = useCallback(async () => {
    if (!window.bakery?.reports?.getReceivablesAgeing) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.reports.getReceivablesAgeing(storeId);
      if (res.success) {
        setReceivablesReport(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load receivables ageing report');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching receivables');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadPayables = useCallback(async () => {
    if (!window.bakery?.reports?.getPayablesAgeing) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.reports.getPayablesAgeing(storeId);
      if (res.success) {
        setPayablesReport(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load payables ageing report');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching payables');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadCheques = useCallback(async () => {
    if (!window.bakery?.reports?.getChequeRegister) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.reports.getChequeRegister(storeId);
      if (res.success) {
        setChequeReport(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load cheque register report');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching cheque register');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadStockValuation = useCallback(async () => {
    if (!window.bakery?.reports?.getStockValuation) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.reports.getStockValuation(storeId);
      if (res.success) {
        setStockValReport(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load stock valuation report');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching stock valuation');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadStakeholdersList = useCallback(async () => {
    if (!window.bakery?.stakeholders?.list) return;
    try {
      const res = await window.bakery.stakeholders.list(storeId);
      if (res.success) {
        setStakeholders(res.data);
        if (res.data.length > 0 && !selectedStakeholderId) {
          setSelectedStakeholderId(res.data[0].id);
        }
      }
    } catch {
      // Ignored
    }
  }, [storeId, selectedStakeholderId]);

  const loadStakeholderStatement = useCallback(async (stkId: number) => {
    if (!window.bakery?.reports?.getStakeholderStatement) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.reports.getStakeholderStatement(storeId, stkId);
      if (res.success) {
        setStakeholderStatement(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load stakeholder statement');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching stakeholder statement');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Initial Load based on tab
  useEffect(() => {
    if (activeSubTab === 'receivables') loadReceivables();
    if (activeSubTab === 'payables') loadPayables();
    if (activeSubTab === 'cheques') loadCheques();
    if (activeSubTab === 'stock-valuation') loadStockValuation();
    if (activeSubTab === 'stakeholder-statements') {
      loadStakeholdersList();
    }
  }, [activeSubTab, loadReceivables, loadPayables, loadCheques, loadStockValuation, loadStakeholdersList]);

  useEffect(() => {
    if (activeSubTab === 'stakeholder-statements' && selectedStakeholderId) {
      loadStakeholderStatement(selectedStakeholderId);
    }
  }, [activeSubTab, selectedStakeholderId, loadStakeholderStatement]);

  // Export to CSV
  const handleExportCsv = (title: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Receivables
  const filteredReceivables = useMemo(() => {
    if (!receivablesReport) return [];
    const q = receivablesSearch.trim().toLowerCase();
    if (!q) return receivablesReport.customers;
    return receivablesReport.customers.filter(c =>
      c.customerName.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [receivablesReport, receivablesSearch]);

  // Filtered Payables
  const filteredPayables = useMemo(() => {
    if (!payablesReport) return [];
    const q = payablesSearch.trim().toLowerCase();
    if (!q) return payablesReport.suppliers;
    return payablesReport.suppliers.filter(s =>
      s.supplierName.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
    );
  }, [payablesReport, payablesSearch]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    if (!chequeReport) return [];
    let list = chequeReport.cheques;

    if (chequeDirectionFilter !== 'ALL') {
      list = list.filter(c => c.direction === chequeDirectionFilter);
    }

    if (chequeMaturityFilter === 'OVERDUE') {
      list = list.filter(c => c.daysUntilMaturity < 0 && c.status === 'POSTED');
    } else if (chequeMaturityFilter === '7DAYS') {
      list = list.filter(c => c.daysUntilMaturity >= 0 && c.daysUntilMaturity <= 7 && c.status === 'POSTED');
    } else if (chequeMaturityFilter === '30DAYS') {
      list = list.filter(c => c.daysUntilMaturity >= 0 && c.daysUntilMaturity <= 30 && c.status === 'POSTED');
    } else if (chequeMaturityFilter === 'CLEARED') {
      list = list.filter(c => c.status === 'CLEARED');
    }

    const q = chequeSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.partyName.toLowerCase().includes(q) ||
        (c.bankName && c.bankName.toLowerCase().includes(q)) ||
        (c.chequeNumber && c.chequeNumber.toLowerCase().includes(q)) ||
        (c.sourceReference && c.sourceReference.toLowerCase().includes(q))
      );
    }

    return list;
  }, [chequeReport, chequeDirectionFilter, chequeMaturityFilter, chequeSearch]);

  // Filtered Stock Items
  const filteredStockItems = useMemo(() => {
    if (!stockValReport) return [];
    let list = stockValReport.items;

    if (selectedStockCategory !== 'ALL') {
      list = list.filter(item => (item.categoryName || 'Uncategorized') === selectedStockCategory);
    }

    const q = stockSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(item =>
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [stockValReport, selectedStockCategory, stockSearch]);

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Tab Navigation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '8px',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'receivables' ? 'active' : ''}`}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px' }}
            onClick={() => setActiveSubTab('receivables')}
          >
            📋 Customer Receivables Ageing
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'payables' ? 'active' : ''}`}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px' }}
            onClick={() => setActiveSubTab('payables')}
          >
            🚚 Supplier Payables Ageing
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'cheques' ? 'active' : ''}`}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px' }}
            onClick={() => setActiveSubTab('cheques')}
          >
            📑 Cheque Register & Forecast
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'stock-valuation' ? 'active' : ''}`}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px' }}
            onClick={() => setActiveSubTab('stock-valuation')}
          >
            📦 Real-time Stock Valuation
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'stakeholder-statements' ? 'active' : ''}`}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px' }}
            onClick={() => setActiveSubTab('stakeholder-statements')}
          >
            🤝 Partner Capital Statements
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className="tab-btn"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#f3f4f6' }}
            onClick={() => {
              if (activeSubTab === 'receivables') loadReceivables();
              if (activeSubTab === 'payables') loadPayables();
              if (activeSubTab === 'cheques') loadCheques();
              if (activeSubTab === 'stock-valuation') loadStockValuation();
              if (activeSubTab === 'stakeholder-statements' && selectedStakeholderId) {
                loadStakeholderStatement(selectedStakeholderId);
              }
            }}
            disabled={loading}
          >
            {loading ? '⏳ Refreshing...' : '🔄 Refresh Data'}
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#f3f4f6' }}
            onClick={() => window.print()}
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #f87171',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CUSTOMER RECEIVABLES AGEING */}
      {/* ========================================================================= */}
      {activeSubTab === 'receivables' && receivablesReport && (
        <div>
          {/* Compact KPI Summary Bar (Low vertical padding per design rules) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Receivables</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {formatRs(receivablesReport.totalReceivablesMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>{receivablesReport.totalCustomersCount} active accounts</div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>Current (&lt;1d)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d' }}>
                {formatRs(receivablesReport.totalCurrentMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a' }}>Not yet overdue</div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>1 - 30 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>
                {formatRs(receivablesReport.total1to30MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>First tier overdue</div>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>31 - 60 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309' }}>
                {formatRs(receivablesReport.total31to60MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#d97706' }}>Requires follow-up</div>
            </div>

            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#9a3412', textTransform: 'uppercase', fontWeight: 600 }}>61 - 90 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#c2410c' }}>
                {formatRs(receivablesReport.total61to90MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#ea580c' }}>High credit risk</div>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>90+ Days (Critical)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                {formatRs(receivablesReport.total90PlusMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#ef4444' }}>Immediate recovery needed</div>
            </div>
          </div>

          {/* Filter Bar & Export */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="🔍 Search customer name or phone..."
              value={receivablesSearch}
              onChange={e => setReceivablesSearch(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                width: '280px',
              }}
            />
            <button
              type="button"
              className="tab-btn"
              style={{ fontSize: '11px', padding: '5px 10px' }}
              onClick={() => {
                const headers = ['Customer Name', 'Phone', 'Total Due (Rs)', 'Current (<1d)', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Unpaid Invoices', 'Oldest Invoice'];
                const rows = filteredReceivables.map(c => [
                  c.customerName,
                  c.phone || '',
                  (c.totalDueMinorUnits / 100).toFixed(2),
                  (c.currentMinorUnits / 100).toFixed(2),
                  (c.days1to30MinorUnits / 100).toFixed(2),
                  (c.days31to60MinorUnits / 100).toFixed(2),
                  (c.days61to90MinorUnits / 100).toFixed(2),
                  (c.days90PlusMinorUnits / 100).toFixed(2),
                  c.unpaidInvoicesCount,
                  c.oldestInvoiceDate || '',
                ]);
                handleExportCsv('Receivables_Ageing_Report', headers, rows);
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Customer Name</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Phone</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Total Due</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#15803d' }}>Current</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>1-30d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#b45309' }}>31-60d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#c2410c' }}>61-90d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#dc2626' }}>90+ Days</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Invoices</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Oldest Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivables.map((c, idx) => (
                  <tr
                    key={c.customerId}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#111827' }}>{c.customerName}</td>
                    <td style={{ padding: '7px 10px', color: '#6b7280' }}>{c.phone || '-'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      {formatRs(c.totalDueMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: c.currentMinorUnits > 0 ? '#15803d' : '#9ca3af' }}>
                      {formatRs(c.currentMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: c.days1to30MinorUnits > 0 ? '#374151' : '#9ca3af' }}>
                      {formatRs(c.days1to30MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: c.days31to60MinorUnits > 0 ? 600 : 400, color: c.days31to60MinorUnits > 0 ? '#b45309' : '#9ca3af' }}>
                      {formatRs(c.days31to60MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: c.days61to90MinorUnits > 0 ? 600 : 400, color: c.days61to90MinorUnits > 0 ? '#c2410c' : '#9ca3af' }}>
                      {formatRs(c.days61to90MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: c.days90PlusMinorUnits > 0 ? 700 : 400, color: c.days90PlusMinorUnits > 0 ? '#dc2626' : '#9ca3af' }}>
                      {formatRs(c.days90PlusMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {c.unpaidInvoicesCount}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#6b7280', fontSize: '11px' }}>
                      {c.oldestInvoiceDate ? c.oldestInvoiceDate.slice(0, 10) : '-'}
                    </td>
                  </tr>
                ))}
                {filteredReceivables.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                      {loading ? 'Calculating customer receivables ageing...' : 'No outstanding customer receivables found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUPPLIER PAYABLES AGEING */}
      {/* ========================================================================= */}
      {activeSubTab === 'payables' && payablesReport && (
        <div>
          {/* Compact KPI Summary Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Payables</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {formatRs(payablesReport.totalPayablesMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>{payablesReport.totalSuppliersCount} suppliers owing</div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>Current (&lt;1d)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d' }}>
                {formatRs(payablesReport.totalCurrentMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a' }}>Not yet overdue</div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>1 - 30 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>
                {formatRs(payablesReport.total1to30MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Normal vendor cycle</div>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>31 - 60 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309' }}>
                {formatRs(payablesReport.total31to60MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#d97706' }}>Payment expected</div>
            </div>

            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#9a3412', textTransform: 'uppercase', fontWeight: 600 }}>61 - 90 Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#c2410c' }}>
                {formatRs(payablesReport.total61to90MinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#ea580c' }}>Overdue payable</div>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>90+ Days</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                {formatRs(payablesReport.total90PlusMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#ef4444' }}>Critical credit freeze</div>
            </div>
          </div>

          {/* Filter Bar & Export */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="🔍 Search supplier name or contact..."
              value={payablesSearch}
              onChange={e => setPayablesSearch(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                width: '280px',
              }}
            />
            <button
              type="button"
              className="tab-btn"
              style={{ fontSize: '11px', padding: '5px 10px' }}
              onClick={() => {
                const headers = ['Supplier Name', 'Phone', 'Total Payable (Rs)', 'Current (<1d)', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Unpaid GRNs', 'Oldest GRN'];
                const rows = filteredPayables.map(s => [
                  s.supplierName,
                  s.phone || '',
                  (s.totalPayableMinorUnits / 100).toFixed(2),
                  (s.currentMinorUnits / 100).toFixed(2),
                  (s.days1to30MinorUnits / 100).toFixed(2),
                  (s.days31to60MinorUnits / 100).toFixed(2),
                  (s.days61to90MinorUnits / 100).toFixed(2),
                  (s.days90PlusMinorUnits / 100).toFixed(2),
                  s.unpaidGrnsCount,
                  s.oldestGrnDate || '',
                ]);
                handleExportCsv('Payables_Ageing_Report', headers, rows);
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Supplier Name</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Phone</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Total Payable</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#15803d' }}>Current</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>1-30d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#b45309' }}>31-60d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#c2410c' }}>61-90d</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#dc2626' }}>90+ Days</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>GRNs</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Oldest GRN</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayables.map((s, idx) => (
                  <tr
                    key={s.supplierId}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#111827' }}>{s.supplierName}</td>
                    <td style={{ padding: '7px 10px', color: '#6b7280' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      {formatRs(s.totalPayableMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: s.currentMinorUnits > 0 ? '#15803d' : '#9ca3af' }}>
                      {formatRs(s.currentMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: s.days1to30MinorUnits > 0 ? '#374151' : '#9ca3af' }}>
                      {formatRs(s.days1to30MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: s.days31to60MinorUnits > 0 ? 600 : 400, color: s.days31to60MinorUnits > 0 ? '#b45309' : '#9ca3af' }}>
                      {formatRs(s.days31to60MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: s.days61to90MinorUnits > 0 ? 600 : 400, color: s.days61to90MinorUnits > 0 ? '#c2410c' : '#9ca3af' }}>
                      {formatRs(s.days61to90MinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: s.days90PlusMinorUnits > 0 ? 700 : 400, color: s.days90PlusMinorUnits > 0 ? '#dc2626' : '#9ca3af' }}>
                      {formatRs(s.days90PlusMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {s.unpaidGrnsCount}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#6b7280', fontSize: '11px' }}>
                      {s.oldestGrnDate ? s.oldestGrnDate.slice(0, 10) : '-'}
                    </td>
                  </tr>
                ))}
                {filteredPayables.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                      {loading ? 'Calculating supplier payables ageing...' : 'No outstanding supplier payables found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CHEQUE REGISTER & CLEARING FORECAST */}
      {/* ========================================================================= */}
      {activeSubTab === 'cheques' && chequeReport && (
        <div>
          {/* Summary KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#0369a1', textTransform: 'uppercase', fontWeight: 600 }}>Inward Cheques (Cust)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0284c7' }}>
                {formatRs(chequeReport.inwardPendingMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                Total Cleared: {formatRs(chequeReport.inwardClearedMinorUnits)}
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#c2410c', textTransform: 'uppercase', fontWeight: 600 }}>Outward Cheques (Supp)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#ea580c' }}>
                {formatRs(chequeReport.outwardPendingMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                Total Cleared: {formatRs(chequeReport.outwardClearedMinorUnits)}
              </div>
            </div>

            <div
              style={{
                background: chequeReport.forecast7DaysNetMinorUnits >= 0 ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${chequeReport.forecast7DaysNetMinorUnits >= 0 ? '#bbf7d0' : '#fca5a5'}`,
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: chequeReport.forecast7DaysNetMinorUnits >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>
                7-Day Net Cashflow
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: chequeReport.forecast7DaysNetMinorUnits >= 0 ? '#15803d' : '#dc2626' }}>
                {formatRs(chequeReport.forecast7DaysNetMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Net clearing in next 7d</div>
            </div>

            <div
              style={{
                background: chequeReport.forecast30DaysNetMinorUnits >= 0 ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${chequeReport.forecast30DaysNetMinorUnits >= 0 ? '#bbf7d0' : '#fca5a5'}`,
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: chequeReport.forecast30DaysNetMinorUnits >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>
                30-Day Net Cashflow
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: chequeReport.forecast30DaysNetMinorUnits >= 0 ? '#15803d' : '#dc2626' }}>
                {formatRs(chequeReport.forecast30DaysNetMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Net clearing in next 30d</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Search bank, cheque #, party..."
                value={chequeSearch}
                onChange={e => setChequeSearch(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  width: '220px',
                }}
              />
              <select
                value={chequeDirectionFilter}
                onChange={e => setChequeDirectionFilter(e.target.value as any)}
                style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '5px' }}
              >
                <option value="ALL">All Types (Inward & Outward)</option>
                <option value="INWARD_CUSTOMER">📥 Inward (From Customers)</option>
                <option value="OUTWARD_SUPPLIER">📤 Outward (To Suppliers)</option>
              </select>
              <select
                value={chequeMaturityFilter}
                onChange={e => setChequeMaturityFilter(e.target.value as any)}
                style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '5px' }}
              >
                <option value="ALL">All Timelines</option>
                <option value="OVERDUE">⚠️ Overdue Cheques</option>
                <option value="7DAYS">⏳ Clearing Next 7 Days</option>
                <option value="30DAYS">📅 Clearing Next 30 Days</option>
                <option value="CLEARED">✅ Cleared</option>
              </select>
            </div>

            <button
              type="button"
              className="tab-btn"
              style={{ fontSize: '11px', padding: '5px 10px' }}
              onClick={() => {
                const headers = ['Type', 'Party', 'Bank', 'Cheque #', 'Amount (Rs)', 'Cheque Date', 'Maturity Status', 'Status', 'Ref'];
                const rows = filteredCheques.map(c => [
                  c.direction === 'INWARD_CUSTOMER' ? 'Inward' : 'Outward',
                  c.partyName,
                  c.bankName || '',
                  c.chequeNumber || '',
                  (c.amountMinorUnits / 100).toFixed(2),
                  c.chequeDate,
                  c.daysUntilMaturity < 0 ? `Overdue by ${Math.abs(c.daysUntilMaturity)}d` : `Due in ${c.daysUntilMaturity}d`,
                  c.status,
                  c.sourceReference || '',
                ]);
                handleExportCsv('Cheque_Register_Report', headers, rows);
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Party Name</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Bank</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Cheque / Ref #</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Cheque Date</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Maturity Timeline</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Action / Attachment</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheques.map((c, idx) => {
                  let badgeBg = '#e0f2fe';
                  let badgeColor = '#0369a1';
                  let maturityLabel = `${c.daysUntilMaturity} days left`;

                  if (c.status === 'CLEARED') {
                    badgeBg = '#dcfce7';
                    badgeColor = '#15803d';
                    maturityLabel = 'Cleared';
                  } else if (c.daysUntilMaturity < 0) {
                    badgeBg = '#fee2e2';
                    badgeColor = '#b91c1c';
                    maturityLabel = `Overdue by ${Math.abs(c.daysUntilMaturity)}d`;
                  } else if (c.daysUntilMaturity === 0) {
                    badgeBg = '#fef3c7';
                    badgeColor = '#b45309';
                    maturityLabel = 'Due Today';
                  } else if (c.daysUntilMaturity <= 7) {
                    badgeBg = '#fef9c3';
                    badgeColor = '#854d0e';
                    maturityLabel = `In ${c.daysUntilMaturity}d`;
                  }

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '7px 10px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: c.direction === 'INWARD_CUSTOMER' ? '#ecfdf5' : '#fff7ed',
                            color: c.direction === 'INWARD_CUSTOMER' ? '#047857' : '#c2410c',
                          }}
                        >
                          {c.direction === 'INWARD_CUSTOMER' ? '📥 INWARD' : '📤 OUTWARD'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#111827' }}>{c.partyName}</td>
                      <td style={{ padding: '7px 10px', color: '#4b5563' }}>{c.bankName || '-'}</td>
                      <td style={{ padding: '7px 10px', color: '#4b5563', fontFamily: 'monospace' }}>
                        {c.chequeNumber || c.sourceReference || '-'}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                        {formatRs(c.amountMinorUnits)}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#4b5563' }}>{c.chequeDate}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            background: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {maturityLabel}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            background: c.status === 'CLEARED' ? '#dcfce7' : c.status === 'BOUNCED' ? '#fee2e2' : '#f3f4f6',
                            color: c.status === 'CLEARED' ? '#15803d' : c.status === 'BOUNCED' ? '#dc2626' : '#4b5563',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        {c.status === 'POSTED' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedChequeForClearing(c)}
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
                            ⚡ Clear Cheque
                          </button>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {c.attachmentPath && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingAttachmentPath(c.attachmentPath!);
                                  setAttachmentTitle(`Cheque Photo: ${c.chequeNumber || c.partyName}`);
                                }}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#2563eb',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                👁️ View Photo
                              </button>
                            )}
                            {c.clearedBankAccountName && (
                              <span style={{ fontSize: '10px', color: '#16a34a' }}>
                                via {c.clearedBankAccountName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredCheques.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                      {loading ? 'Scanning cheque register...' : 'No cheques found matching filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. REAL-TIME STOCK VALUATION REPORT */}
      {/* ========================================================================= */}
      {activeSubTab === 'stock-valuation' && stockValReport && (
        <div>
          {/* Summary KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Units On-Hand</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {Number(stockValReport.totalStockQuantity.toFixed(2))}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Across {stockValReport.items.length} product variants</div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>Wholesale Cost Value</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {formatRs(stockValReport.totalCostValuationMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Actual invested inventory cost</div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#0369a1', textTransform: 'uppercase', fontWeight: 600 }}>Retail Sales Value</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0284c7' }}>
                {formatRs(stockValReport.totalRetailValuationMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Expected gross realization</div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>Potential Gross Profit</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d' }}>
                {formatRs(stockValReport.totalPotentialProfitMinorUnits)}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a' }}>
                {stockValReport.totalRetailValuationMinorUnits > 0
                  ? `${((stockValReport.totalPotentialProfitMinorUnits / stockValReport.totalRetailValuationMinorUnits) * 100).toFixed(1)}% unrealized margin`
                  : '0% margin'}
              </div>
            </div>
          </div>

          {/* Category Breakdown Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>Categories:</span>
            <button
              type="button"
              className={`tab-btn ${selectedStockCategory === 'ALL' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setSelectedStockCategory('ALL')}
            >
              All Categories ({stockValReport.items.length})
            </button>
            {stockValReport.categoryBreakdown.map(cat => (
              <button
                key={cat.categoryName}
                type="button"
                className={`tab-btn ${selectedStockCategory === cat.categoryName ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setSelectedStockCategory(cat.categoryName)}
              >
                {cat.categoryName} ({cat.itemCount}) · {formatRs(cat.totalValuationMinorUnits)}
              </button>
            ))}
          </div>

          {/* Search Bar & Export */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="🔍 Search product name, SKU, or category..."
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                width: '300px',
              }}
            />
            <button
              type="button"
              className="tab-btn"
              style={{ fontSize: '11px', padding: '5px 10px' }}
              onClick={() => {
                const headers = ['Product Name', 'SKU', 'Category', 'Unit', 'Qty On Hand', 'Cost Rate (Rs)', 'Retail Rate (Rs)', 'Cost Valuation (Rs)', 'Retail Valuation (Rs)', 'Potential Profit (Rs)'];
                const rows = filteredStockItems.map(item => [
                  item.productName,
                  item.sku,
                  item.categoryName || 'Uncategorized',
                  item.unitCode,
                  item.quantityOnHand,
                  (item.wholesaleCostPriceMinorUnits / 100).toFixed(2),
                  (item.retailPriceMinorUnits / 100).toFixed(2),
                  (item.totalCostValuationMinorUnits / 100).toFixed(2),
                  (item.totalRetailValuationMinorUnits / 100).toFixed(2),
                  (item.potentialGrossProfitMinorUnits / 100).toFixed(2),
                ]);
                handleExportCsv('Stock_Valuation_Report', headers, rows);
              }}
            >
              📥 Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Product Name</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>SKU</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>On-Hand Qty</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Wholesale Rate</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Retail Rate</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Cost Value</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#0369a1' }}>Retail Value</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#15803d' }}>Unrealized Profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockItems.map((item, idx) => (
                  <tr
                    key={item.variantId}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#111827' }}>{item.productName}</td>
                    <td style={{ padding: '7px 10px', color: '#6b7280', fontFamily: 'monospace' }}>{item.sku}</td>
                    <td style={{ padding: '7px 10px', color: '#4b5563' }}>{item.categoryName || '-'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                      {Number(item.quantityOnHand.toFixed(2))} <span style={{ fontSize: '10px', color: '#6b7280' }}>{item.unitCode}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#4b5563' }}>
                      {formatRs(item.wholesaleCostPriceMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#4b5563' }}>
                      {formatRs(item.retailPriceMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      {formatRs(item.totalCostValuationMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                      {formatRs(item.totalRetailValuationMinorUnits)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                      {formatRs(item.potentialGrossProfitMinorUnits)}
                    </td>
                  </tr>
                ))}
                {filteredStockItems.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                      {loading ? 'Evaluating inventory balances...' : 'No stock items match filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. STAKEHOLDER STATEMENTS & RUNNING BALANCE */}
      {/* ========================================================================= */}
      {activeSubTab === 'stakeholder-statements' && (
        <div>
          {/* Stakeholder Selector Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Select Stakeholder:</span>
              <select
                value={selectedStakeholderId || ''}
                onChange={e => setSelectedStakeholderId(Number(e.target.value))}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  fontWeight: 600,
                  minWidth: '220px',
                }}
              >
                {stakeholders.map(s => {
                  const equityPct = s.currentEquity ? (s.currentEquity.ownershipBps / 100) : 0;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.stakeholderType}) · {equityPct}% Equity
                    </option>
                  );
                })}
              </select>
            </div>

            {stakeholderStatement && (
              <button
                type="button"
                className="tab-btn"
                style={{ fontSize: '11px', padding: '5px 10px' }}
                onClick={() => {
                  const headers = ['Txn #', 'Date', 'Type', 'Amount (Rs)', 'Method', 'Reference', 'Notes', 'Running Balance (Rs)'];
                  const rows = stakeholderStatement.transactions.map(t => [
                    t.txnNumber,
                    t.txnDate,
                    t.type,
                    (t.amountMinorUnits / 100).toFixed(2),
                    t.paymentMethod,
                    t.reference || '',
                    t.notes || '',
                    (t.runningBalanceMinorUnits / 100).toFixed(2),
                  ]);
                  handleExportCsv(`Statement_${stakeholderStatement.fullName}`, headers, rows);
                }}
              >
                📥 Export Statement CSV
              </button>
            )}
          </div>

          {/* Statement Content */}
          {stakeholderStatement ? (
            <div>
              {/* Compact KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '6px 12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Invested</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                    {formatRs(stakeholderStatement.totalCapitalInvestedMinorUnits)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>{stakeholderStatement.ownershipPercent}% ownership</div>
                </div>

                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '6px 12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>Profit Allocated</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d' }}>
                    {formatRs(stakeholderStatement.totalProfitDistributedMinorUnits)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#16a34a' }}>Cumulative share</div>
                </div>

                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '6px 12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>Drawings / Payouts</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                    {formatRs(stakeholderStatement.totalDrawingsMinorUnits)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#ef4444' }}>Withdrawn to date</div>
                </div>

                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '6px 12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: 600 }}>Ending Balance</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#1d4ed8' }}>
                    {formatRs(stakeholderStatement.currentCapitalBalanceMinorUnits)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#3b82f6' }}>Current net equity value</div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Txn #</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Ref / Notes</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#1d4ed8' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stakeholderStatement.transactions.map((t, idx) => {
                      const isCredit = t.type === 'INITIAL_CAPITAL' || t.type === 'ADDITIONAL_CAPITAL' || t.type === 'PROFIT_DISTRIBUTION';
                      return (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                          }}
                        >
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#4b5563' }}>{t.txnNumber}</td>
                          <td style={{ padding: '7px 10px', color: '#4b5563' }}>{t.txnDate}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                background: isCredit ? '#ecfdf5' : '#fee2e2',
                                color: isCredit ? '#047857' : '#b91c1c',
                              }}
                            >
                              {t.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px', color: '#6b7280' }}>{t.paymentMethod}</td>
                          <td style={{ padding: '7px 10px', color: '#4b5563' }}>
                            {t.reference ? `${t.reference} ` : ''}
                            {t.notes ? `(${t.notes})` : ''}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: isCredit ? '#15803d' : '#dc2626',
                            }}
                          >
                            {isCredit ? '+' : '-'}{formatRs(t.amountMinorUnits)}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>
                            {formatRs(t.runningBalanceMinorUnits)}
                          </td>
                        </tr>
                      );
                    })}
                    {stakeholderStatement.transactions.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                          No capital movements recorded for this stakeholder.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              {loading ? 'Generating statement...' : 'Select a stakeholder to view capital statement.'}
            </div>
          )}
        </div>
      )}

      {/* Cheque Clearing Modal */}
      {selectedChequeForClearing && (
        <ClearChequeModal
          cheque={selectedChequeForClearing}
          onClose={() => setSelectedChequeForClearing(null)}
          onSuccess={() => {
            loadCheques();
          }}
        />
      )}

      {/* Photo Attachment Viewer Lightbox */}
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
