import React, { useState, useEffect, useCallback } from 'react';
import { SaleSummary, SaleReceipt } from '@rz-crm/contracts';
import { RzLogo } from './RzLogo.js';

interface CommercialInvoicesTabProps {
  storeId: number;
  onOpenReceiptModal?: (receipt: SaleReceipt) => void;
}

export const CommercialInvoicesTab: React.FC<CommercialInvoicesTabProps> = ({
  storeId,
  onOpenReceiptModal,
}) => {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'wholesale' | 'retail'>('all');

  // Payment Recording Modal
  const [paymentTargetSale, setPaymentTargetSale] = useState<SaleSummary | null>(null);
  const [payAmountRs, setPayAmountRs] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'cheque'>('cash');
  const [payRef, setPayRef] = useState<string>('');
  const [payBank, setPayBank] = useState<string>('');
  const [payChequeDate, setPayChequeDate] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [savingPayment, setSavingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Invoice Details Modal
  const [viewingReceipt, setViewingReceipt] = useState<SaleReceipt | null>(null);
  const [receiptViewMode, setReceiptViewMode] = useState<'thermal' | 'commercial'>('commercial');
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.pos.getRecentSales(storeId);
      if (res.success) {
        setSales(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load sales register');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching sales register');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Open Payment Modal
  const handleOpenPayment = (sale: SaleSummary) => {
    setPaymentTargetSale(sale);
    setPayAmountRs(((sale.balanceDueMinorUnits ?? 0) / 100).toFixed(2));
    setPayMethod('cash');
    setPayRef('');
    setPayBank('');
    setPayChequeDate('');
    setPayNotes('');
    setPaymentError(null);
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetSale) return;
    const amountMinor = Math.round(parseFloat(payAmountRs || '0') * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setPaymentError('Payment amount must be greater than 0.');
      return;
    }
    if (amountMinor > (paymentTargetSale.balanceDueMinorUnits ?? 0)) {
      setPaymentError(`Payment amount cannot exceed remaining balance (Rs. ${((paymentTargetSale.balanceDueMinorUnits ?? 0) / 100).toFixed(2)}).`);
      return;
    }

    setSavingPayment(true);
    setPaymentError(null);
    try {
      const res = await window.bakery.pos.recordSalePayment({
        saleId: paymentTargetSale.id,
        amountMinorUnits: amountMinor,
        paymentMethod: payMethod,
        reference: payRef.trim() || undefined,
        bankName: payBank.trim() || undefined,
        chequeDate: payChequeDate.trim() || undefined,
        notes: payNotes.trim() || undefined,
        actorId: 'admin',
      });

      if (res.success) {
        setPaymentTargetSale(null);
        await loadSales();
      } else {
        setPaymentError(res.error?.message || 'Failed to record payment');
      }
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Error submitting payment');
    } finally {
      setSavingPayment(false);
    }
  };

  // Open View/Reprint Receipt
  const handleViewReceipt = async (saleId: number) => {
    setLoadingReceipt(true);
    try {
      const res = await window.bakery.pos.getSaleReceipt(saleId);
      if (res.success) {
        if (onOpenReceiptModal) {
          onOpenReceiptModal(res.data);
        } else {
          setViewingReceipt(res.data);
        }
      } else {
        alert(res.error?.message || 'Receipt could not be loaded');
      }
    } catch {
      alert('Error fetching receipt');
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (sales.length === 0) return;
    const headers = ['Invoice Number', 'Date', 'Customer', 'Order Type', 'Payment Method', 'Payment Status', 'Total (PKR)', 'Paid (PKR)', 'Balance (PKR)', 'Due Date'];
    const rows = filteredSales.map((s) => [
      `"${s.invoiceNumber}"`,
      `"${s.createdAtUtc}"`,
      `"${s.customerName || 'Walk-In'}"`,
      s.orderType,
      s.paymentMethod,
      s.paymentStatus,
      ((s.totalMinorUnits || 0) / 100).toFixed(2),
      ((s.amountPaidMinorUnits || 0) / 100).toFixed(2),
      ((s.balanceDueMinorUnits || 0) / 100).toFixed(2),
      `"${s.dueDate || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rz-crm-invoices-register-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtering
  const filteredSales = sales.filter((s) => {
    if (statusFilter === 'paid' && s.paymentStatus !== 'paid') return false;
    if (statusFilter === 'partial' && s.paymentStatus !== 'partial') return false;
    if (statusFilter === 'unpaid' && s.paymentStatus !== 'unpaid') return false;
    if (statusFilter === 'wholesale' && s.orderType !== 'wholesale') return false;
    if (statusFilter === 'retail' && s.orderType !== 'retail') return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchInv = s.invoiceNumber.toLowerCase().includes(q);
      const matchCust = (s.customerName || '').toLowerCase().includes(q);
      return matchInv || matchCust;
    }
    return true;
  });

  // KPI Calculations
  const totalInvoices = sales.length;
  const totalVolumeRs = sales.reduce((acc, s) => acc + (s.totalMinorUnits || 0) / 100, 0);
  const totalPaidRs = sales.reduce((acc, s) => acc + (s.amountPaidMinorUnits || 0) / 100, 0);
  const totalReceivablesRs = sales.reduce((acc, s) => acc + (s.balanceDueMinorUnits || 0) / 100, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Sleek KPI Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <div className="panel-card" style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Invoices</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginTop: '2px' }}>
            {totalInvoices} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>orders</span>
          </div>
        </div>

        <div className="panel-card" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #cbd5e1' }}>
          <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Gross Sales Volume</div>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginTop: '2px' }}>
            Rs. {totalVolumeRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="panel-card" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '10px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Collected Revenue</div>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#15803d', lineHeight: 1.2, marginTop: '2px' }}>
            Rs. {totalPaidRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="panel-card" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', border: '1px solid #fecdd3' }}>
          <div style={{ fontSize: '10px', color: '#9f1239', fontWeight: 700, textTransform: 'uppercase' }}>Receivables Due</div>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#e11d48', lineHeight: 1.2, marginTop: '2px' }}>
            Rs. {totalReceivablesRs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Invoices Table Panel */}
      <div className="panel-card">
        {/* Filter & Action Toolbar */}
        <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-title">Invoices &amp; Commercial Sales Register</span>
            <span className="panel-badge ok">{filteredSales.length} of {sales.length} records</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ width: '220px', height: '32px', fontSize: '12px' }}
            />

            {/* Filter Pills */}
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
              {(['all', 'paid', 'partial', 'unpaid', 'wholesale', 'retail'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    border: 'none',
                    background: statusFilter === st ? '#1e293b' : '#f8fafc',
                    color: statusFilter === st ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCsv}
              style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: 700 }}
              title="Export Invoices Register CSV"
            >
              📥 Export CSV
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={loadSales}
              style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700 }}
              title="Refresh Sales"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="status-banner unhealthy" style={{ margin: '8px 14px' }}>
            {errorMsg}
          </div>
        )}

        {/* Invoices Table */}
        <div style={{ overflowX: 'auto', maxHeight: '580px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Invoice #</th>
                <th style={{ width: '130px' }}>Date</th>
                <th>Customer / Account</th>
                <th style={{ width: '90px' }}>Type</th>
                <th style={{ width: '90px' }}>Method</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '105px' }}>Total Amount</th>
                <th style={{ textAlign: 'right', width: '105px' }}>Amount Paid</th>
                <th style={{ textAlign: 'right', width: '105px' }}>Balance Due</th>
                <th style={{ textAlign: 'center', width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    ⏳ Loading sales register...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    No invoices match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const totalRs = (s.totalMinorUnits || 0) / 100;
                  const paidRs = (s.amountPaidMinorUnits || 0) / 100;
                  const dueRs = (s.balanceDueMinorUnits || 0) / 100;

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>
                        {s.invoiceNumber}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '11px' }}>
                        {new Date(s.createdAtUtc).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ fontWeight: 700, color: '#1e293b' }}>
                        {s.customerName || 'Walk-In Customer'}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: s.orderType === 'wholesale' ? '#e0e7ff' : '#f1f5f9',
                            color: s.orderType === 'wholesale' ? '#3730a3' : '#475569',
                          }}
                        >
                          {s.orderType === 'wholesale' ? '💼 Wholesale' : '🛒 Retail'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: '#475569', fontWeight: 600 }}>
                        {s.paymentMethod.replace('_', ' ')}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background:
                              s.paymentStatus === 'paid'
                                ? '#dcfce7'
                                : s.paymentStatus === 'partial'
                                ? '#fef3c7'
                                : '#fee2e2',
                            color:
                              s.paymentStatus === 'paid'
                                ? '#166534'
                                : s.paymentStatus === 'partial'
                                ? '#92400e'
                                : '#991b1b',
                          }}
                        >
                          {s.paymentStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        Rs. {totalRs.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                        Rs. {paidRs.toFixed(2)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: dueRs > 0 ? '#dc2626' : '#64748b',
                        }}
                      >
                        Rs. {dueRs.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '3px 7px', fontSize: '11px', fontWeight: 700 }}
                            onClick={() => handleViewReceipt(s.id)}
                            disabled={loadingReceipt}
                            title="View / Print Invoice"
                          >
                            👁️ View
                          </button>
                          {dueRs > 0 && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '3px 7px', fontSize: '11px', fontWeight: 700, background: '#16a34a' }}
                              onClick={() => handleOpenPayment(s)}
                              title="Record Payment"
                            >
                              💳 Pay
                            </button>
                          )}
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

      {/* MODAL: RECORD SUBSEQUENT PAYMENT */}
      {paymentTargetSale && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Record Payment: {paymentTargetSale.invoiceNumber}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPaymentTargetSale(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <strong style={{ color: '#0f172a' }}>{paymentTargetSale.customerName || 'Walk-In'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Total Invoice:</span>
                <span>Rs. {((paymentTargetSale.totalMinorUnits || 0) / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Already Paid:</span>
                <span style={{ color: '#15803d' }}>Rs. {((paymentTargetSale.amountPaidMinorUnits || 0) / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', fontWeight: 800, fontSize: '13px' }}>
                <span style={{ color: '#dc2626' }}>Balance Remaining Due:</span>
                <span style={{ color: '#dc2626' }}>Rs. {((paymentTargetSale.balanceDueMinorUnits || 0) / 100).toFixed(2)}</span>
              </div>
            </div>

            {paymentError && (
              <div className="status-banner unhealthy" style={{ marginBottom: '12px' }}>
                {paymentError}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px' }}>Payment Method *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(['cash', 'bank_transfer', 'cheque'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      style={{
                        padding: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                        borderRadius: '6px',
                        border: payMethod === m ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: payMethod === m ? '#eff6ff' : '#ffffff',
                        color: payMethod === m ? '#1e40af' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {m === 'cash' ? '💵 Cash' : m === 'bank_transfer' ? '🏦 Bank' : '📝 Cheque'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px' }}>Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={((paymentTargetSale.balanceDueMinorUnits ?? 0) / 100).toString()}
                  value={payAmountRs}
                  onChange={(e) => setPayAmountRs(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '16px', fontWeight: 800 }}
                  required
                />
              </div>

              {payMethod === 'bank_transfer' && (
                <>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank, HBL"
                      value={payBank}
                      onChange={(e) => setPayBank(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Txn ID / Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. IBFT-883921"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {payMethod === 'cheque' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Cheque #</label>
                      <input
                        type="text"
                        placeholder="e.g. CHQ-99212"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Cheque Date</label>
                      <input
                        type="date"
                        value={payChequeDate}
                        onChange={(e) => setPayChequeDate(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Bank Name</label>
                    <input
                      type="text"
                      placeholder="Bank issuing cheque"
                      value={payBank}
                      onChange={(e) => setPayBank(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setPaymentTargetSale(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2, background: '#16a34a', borderColor: '#15803d' }}
                  disabled={savingPayment}
                >
                  {savingPayment ? 'Saving...' : '✓ Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STANDALONE RECEIPT & COMMERCIAL INVOICE PREVIEW */}
      {viewingReceipt && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: receiptViewMode === 'commercial' ? '680px' : '380px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '10px',
              padding: '14px',
              color: '#000000',
              overflow: 'hidden',
            }}
          >
            {/* View Mode Toggle Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setReceiptViewMode('commercial')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: receiptViewMode === 'commercial' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: receiptViewMode === 'commercial' ? '#eff6ff' : '#f8fafc',
                    color: receiptViewMode === 'commercial' ? '#1e40af' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  📄 Commercial Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptViewMode('thermal')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: receiptViewMode === 'thermal' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: receiptViewMode === 'thermal' ? '#eff6ff' : '#f8fafc',
                    color: receiptViewMode === 'thermal' ? '#1e40af' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  🖨️ Thermal POS Receipt
                </button>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setViewingReceipt(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Printable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '10px' }}>
              {receiptViewMode === 'commercial' ? (
                /* A4 Style Commercial Invoice */
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', color: '#0f172a' }}>
                  {/* Top Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RzLogo size={42} theme="light" />
                      <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>RZ ENTERPRISES</h2>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>Commercial Trading &amp; Wholesale Distribution</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Ph: 0343-7763677 | 0309-8809054 | 0301-6008625</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e40af', textTransform: 'uppercase' }}>COMMERCIAL INVOICE</div>
                      <div style={{ fontSize: '12px', fontWeight: 800 }}>Invoice #: {viewingReceipt.invoiceNumber}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Date: {new Date(viewingReceipt.createdAtUtc).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Bill To & Invoice Meta Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px', fontSize: '11.5px' }}>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>BILL TO CLIENT</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px' }}>{viewingReceipt.customerName || 'Walk-In Customer'}</div>
                      {viewingReceipt.customerCompanyName && <div style={{ fontWeight: 600 }}>{viewingReceipt.customerCompanyName}</div>}
                      {viewingReceipt.customerTaxNumber && <div>NTN/Tax #: {viewingReceipt.customerTaxNumber}</div>}
                      {viewingReceipt.customerPhone && <div>Phone: {viewingReceipt.customerPhone}</div>}
                      {viewingReceipt.customerAddress && <div>Address: {viewingReceipt.customerAddress}</div>}
                    </div>

                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Order Type:</span>
                        <strong style={{ textTransform: 'uppercase' }}>{viewingReceipt.orderType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Location:</span>
                        <strong>{viewingReceipt.locationName || 'Main Showroom'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Payment Method:</span>
                        <strong style={{ textTransform: 'capitalize' }}>{viewingReceipt.paymentMethod.replace('_', ' ')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Payment Status:</span>
                        <strong style={{ textTransform: 'uppercase', color: viewingReceipt.paymentStatus === 'paid' ? '#15803d' : '#dc2626' }}>
                          {viewingReceipt.paymentStatus}
                        </strong>
                      </div>
                      {viewingReceipt.dueDate && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Due Date:</span>
                          <strong>{viewingReceipt.dueDate}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Table */}
                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', marginBottom: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ textAlign: 'left', padding: '6px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '6px' }}>SKU</th>
                        <th style={{ textAlign: 'left', padding: '6px' }}>Item Description</th>
                        <th style={{ textAlign: 'center', padding: '6px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '6px' }}>Unit Rate</th>
                        <th style={{ textAlign: 'right', padding: '6px' }}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingReceipt.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '6px', fontWeight: 600 }}>{it.sku}</td>
                          <td style={{ padding: '6px', fontWeight: 700 }}>{it.productName}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>Rs. {(it.unitPriceMinorUnits / 100).toFixed(2)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800 }}>Rs. {(it.totalMinorUnits / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals Summary */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '260px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal:</span>
                        <strong>Rs. {(viewingReceipt.subtotalMinorUnits / 100).toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '4px', fontSize: '14px', fontWeight: 900 }}>
                        <span>Net Payable:</span>
                        <span>Rs. {(viewingReceipt.totalMinorUnits / 100).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                        <span>Amount Paid:</span>
                        <span>Rs. {(viewingReceipt.amountPaidMinorUnits / 100).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: viewingReceipt.balanceDueMinorUnits > 0 ? '#dc2626' : '#64748b', fontWeight: 800 }}>
                        <span>Balance Due:</span>
                        <span>Rs. {(viewingReceipt.balanceDueMinorUnits / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Compact Thermal View */
                <div style={{ maxWidth: '78mm', margin: '0 auto', fontSize: '11px', textAlign: 'center' }}>
                  <RzLogo size={36} theme="light" />
                  <h3 style={{ margin: '4px 0', fontSize: '16px', fontWeight: 900 }}>RZ ENTERPRISES</h3>
                  <div>Commercial Trading &amp; POS</div>
                  <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0' }}>
                    Invoice: {viewingReceipt.invoiceNumber} | {new Date(viewingReceipt.createdAtUtc).toLocaleDateString()}
                  </div>
                  <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingReceipt.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dashed #999' }}>
                          <td>{it.productName}</td>
                          <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>Rs. {(it.totalMinorUnits / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ borderTop: '1px solid #000', marginTop: '6px', paddingTop: '4px', textAlign: 'right', fontWeight: 800, fontSize: '13px' }}>
                    Total: Rs. {(viewingReceipt.totalMinorUnits / 100).toFixed(2)}
                  </div>
                  <div style={{ textAlign: 'right', color: '#15803d', fontSize: '11px' }}>
                    Paid: Rs. {(viewingReceipt.amountPaidMinorUnits / 100).toFixed(2)}
                  </div>
                  {viewingReceipt.balanceDueMinorUnits > 0 && (
                    <div style={{ textAlign: 'right', color: '#dc2626', fontWeight: 800, fontSize: '12px' }}>
                      Balance Due: Rs. {(viewingReceipt.balanceDueMinorUnits / 100).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Print & Action Bar */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setViewingReceipt(null)}>
                ✕ Close
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 2, background: '#d97706', borderColor: '#b45309' }}
                onClick={() => window.print()}
              >
                🖨️ Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
