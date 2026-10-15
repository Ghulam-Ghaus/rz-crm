import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SalesReturn,
  PostSalesReturnInput,
  PurchaseReturn,
  PostPurchaseReturnInput,
  Supplier,
  ProductListItem,
  Customer,
  StockLocationItem,
  SaleReceipt,
} from '@rz-crm/contracts';

interface ReturnsTabProps {
  storeId: number;
  currentUserName: string;
}

export const ReturnsTab: React.FC<ReturnsTabProps> = ({ storeId, currentUserName }) => {
  // Navigation: Sales Returns (Credit Notes) vs Purchase Returns (Debit Notes)
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'purchases'>('sales');

  // Lists & State
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<StockLocationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Customer Sales Return Modal State
  const [showSalesReturnModal, setShowSalesReturnModal] = useState<boolean>(false);
  const [srInvoiceSearch, setSrInvoiceSearch] = useState<string>('');
  const [srSearchedSale, setSrSearchedSale] = useState<SaleReceipt | null>(null);
  const [srSearchingSale, setSrSearchingSale] = useState<boolean>(false);
  const [srCustomerId, setSrCustomerId] = useState<number | undefined>(undefined);
  const [srCustomerName, setSrCustomerName] = useState<string>('');
  const [srReason, setSrReason] = useState<string>('Defective / Quality Issue');
  const [srRefundMethod, setSrRefundMethod] = useState<'CREDIT_NOTE' | 'CASH_REFUND' | 'BANK_REFUND' | 'NO_REFUND'>('CREDIT_NOTE');
  const [srNotes, setSrNotes] = useState<string>('');
  const [srLines, setSrLines] = useState<Array<{
    productVariantId: number;
    productName: string;
    sku: string;
    quantity: number;
    maxQuantity?: number;
    unitCode: string;
    unitPriceMinorUnits: number;
    condition: 'RESTOCK' | 'DAMAGED_SCRAP';
    targetLocationId: number;
    reason?: string;
    saleItemId?: number;
  }>>([]);
  const [srSubmitting, setSrSubmitting] = useState<boolean>(false);
  const [srModalError, setSrModalError] = useState<string | null>(null);

  // Supplier Purchase Return Modal State
  const [showPurchaseReturnModal, setShowPurchaseReturnModal] = useState<boolean>(false);
  const [prSupplierId, setPrSupplierId] = useState<number | undefined>(undefined);
  const [prInvoiceRef, setPrInvoiceRef] = useState<string>('');
  const [prReason, setPrReason] = useState<string>('Damaged / Rejected Delivery');
  const [prSettlementMethod, setPrSettlementMethod] = useState<'DEBIT_NOTE' | 'CASH_REFUND' | 'BANK_REFUND'>('DEBIT_NOTE');
  const [prNotes, setPrNotes] = useState<string>('');
  const [prLines, setPrLines] = useState<Array<{
    productVariantId: number;
    productName: string;
    sku: string;
    quantity: number;
    unitCode: string;
    unitCostMinorUnits: number;
    sourceLocationId: number;
    lotNumber?: string;
    reason?: string;
  }>>([]);
  const [prSelectedVariantId, setPrSelectedVariantId] = useState<number>(0);
  const [prItemQty, setPrItemQty] = useState<number>(1);
  const [prItemCostRs, setPrItemCostRs] = useState<string>('0.00');
  const [prItemSourceLocId, setPrItemSourceLocId] = useState<number>(1);
  const [prItemLot, setPrItemLot] = useState<string>('');
  const [prItemReason, setPrItemReason] = useState<string>('Quality Rejection');
  const [prSubmitting, setPrSubmitting] = useState<boolean>(false);
  const [prModalError, setPrModalError] = useState<string | null>(null);

  // Print Slip Modal State
  const [printSlipType, setPrintSlipType] = useState<'sales' | 'purchase' | null>(null);
  const [selectedSalesReturn, setSelectedSalesReturn] = useState<SalesReturn | null>(null);
  const [selectedPurchaseReturn, setSelectedPurchaseReturn] = useState<PurchaseReturn | null>(null);
  const [slipFormat, setSlipFormat] = useState<'commercial' | 'thermal'>('commercial');

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [srRes, prRes, supRes, prodRes, custRes, locRes] = await Promise.all([
        window.bakery.returns.listSalesReturns(storeId),
        window.bakery.returns.listPurchaseReturns(storeId),
        window.bakery.purchasing.getSuppliers(storeId),
        window.bakery.catalog.getProducts(),
        window.bakery.customOrders.searchCustomers(storeId, ''),
        window.bakery.inventory.getLocations(storeId),
      ]);

      if (srRes.success) setSalesReturns(srRes.data);
      if (prRes.success) setPurchaseReturns(prRes.data);
      if (supRes.success) setSuppliers(supRes.data);
      if (prodRes.success) setProducts(prodRes.data);
      if (custRes.success) setCustomers(custRes.data);
      if (locRes.success) setLocations(locRes.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching returns data');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPIs
  const totalSalesReturnMinorUnits = useMemo(() => {
    return salesReturns.reduce((acc, r) => acc + r.refundAmountMinorUnits, 0);
  }, [salesReturns]);

  const totalPurchaseReturnMinorUnits = useMemo(() => {
    return purchaseReturns.reduce((acc, r) => acc + r.refundAmountMinorUnits, 0);
  }, [purchaseReturns]);

  const totalCreditNotesCount = useMemo(() => {
    return salesReturns.filter((r) => r.refundMethod === 'CREDIT_NOTE').length;
  }, [salesReturns]);

  const totalDebitNotesCount = useMemo(() => {
    return purchaseReturns.filter((r) => r.settlementMethod === 'DEBIT_NOTE').length;
  }, [purchaseReturns]);

  // Search Sale Invoice by Number for Customer Return
  const handleSearchSale = async () => {
    if (!srInvoiceSearch.trim()) return;
    setSrSearchingSale(true);
    setSrModalError(null);
    try {
      const salesRes = await window.bakery.pos.getRecentSales(storeId);
      if (salesRes.success) {
        const foundSummary = salesRes.data.find(
          (s) => s.invoiceNumber.toLowerCase() === srInvoiceSearch.trim().toLowerCase()
        );
        if (foundSummary) {
          const detailRes = await window.bakery.pos.getSaleReceipt(foundSummary.id);
          if (detailRes.success) {
            const receipt = detailRes.data;
            setSrSearchedSale(receipt);
            setSrCustomerName(receipt.customerName || '');
            const defaultLocId = locations.find((l) => l.code === 'SR-MAIN')?.id || locations[0]?.id || 1;
            setSrLines(
              receipt.items.map((it) => {
                const matchedVariant = products.find((p) => p.sku === it.sku);
                return {
                  productVariantId: matchedVariant?.variantId || 1,
                  productName: it.productName,
                  sku: it.sku,
                  quantity: it.quantity,
                  maxQuantity: it.quantity,
                  unitCode: 'pcs',
                  unitPriceMinorUnits: it.unitPriceMinorUnits || Math.round(it.totalMinorUnits / (it.quantity || 1)),
                  condition: 'RESTOCK',
                  targetLocationId: defaultLocId,
                  reason: 'Customer return',
                  saleItemId: undefined,
                };
              })
            );
            return;
          }
        }
      }
      setSrModalError(`Invoice "${srInvoiceSearch.trim()}" not found. You can add items manually below.`);
    } catch (err: unknown) {
      setSrModalError(err instanceof Error ? err.message : 'Error finding invoice');
    } finally {
      setSrSearchingSale(false);
    }
  };

  // Add Manual Item to Customer Sales Return
  const handleAddManualSalesReturnLine = (variantId: number) => {
    const prod = products.find((p) => p.variantId === variantId);
    if (!prod) return;
    const defaultLocId = locations.find((l) => l.code === 'SR-MAIN')?.id || locations[0]?.id || 1;
    setSrLines((prev) => [
      ...prev,
      {
        productVariantId: prod.variantId,
        productName: prod.name,
        sku: prod.sku,
        quantity: 1,
        unitCode: prod.baseUnitCode || 'pcs',
        unitPriceMinorUnits: prod.priceMinorUnits,
        condition: 'RESTOCK',
        targetLocationId: defaultLocId,
        reason: 'Customer return',
      },
    ]);
  };

  // Add Manual Item to Supplier Purchase Return
  const handleAddPurchaseReturnLine = () => {
    if (!prSelectedVariantId) return;
    const prod = products.find((p) => p.variantId === prSelectedVariantId);
    if (!prod) return;

    const unitCostMinor = Math.round(parseFloat(prItemCostRs || '0') * 100);
    setPrLines((prev) => [
      ...prev,
      {
        productVariantId: prod.variantId,
        productName: prod.name,
        sku: prod.sku,
        quantity: prItemQty,
        unitCode: prod.baseUnitCode || 'pcs',
        unitCostMinorUnits: unitCostMinor > 0 ? unitCostMinor : prod.costMinorUnits,
        sourceLocationId: prItemSourceLocId,
        lotNumber: prItemLot.trim() || undefined,
        reason: prItemReason,
      },
    ]);

    setPrItemQty(1);
    setPrItemLot('');
  };

  // Submit Sales Return
  const handleSubmitSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (srLines.length === 0) {
      setSrModalError('Please add at least one line item to return.');
      return;
    }

    const totalRefundMinor = srLines.reduce(
      (sum, l) => sum + Math.round(l.unitPriceMinorUnits * l.quantity),
      0
    );

    const input: PostSalesReturnInput = {
      saleId: srSearchedSale?.saleId,
      originalInvoiceNumber: srSearchedSale?.invoiceNumber || srInvoiceSearch.trim() || undefined,
      customerId: srCustomerId,
      customerName: srCustomerName.trim() || undefined,
      reason: srReason,
      refundMethod: srRefundMethod,
      totalAmountMinorUnits: totalRefundMinor,
      refundAmountMinorUnits: srRefundMethod === 'NO_REFUND' ? 0 : totalRefundMinor,
      processedBy: currentUserName,
      notes: srNotes.trim() || undefined,
      lines: srLines.map((l) => ({
        saleItemId: l.saleItemId,
        productVariantId: l.productVariantId,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        unitCode: l.unitCode,
        unitPriceMinorUnits: l.unitPriceMinorUnits,
        totalPriceMinorUnits: Math.round(l.unitPriceMinorUnits * l.quantity),
        condition: l.condition,
        targetLocationId: l.targetLocationId,
        reason: l.reason,
      })),
    };

    setSrSubmitting(true);
    setSrModalError(null);
    try {
      const res = await window.bakery.returns.createSalesReturn(input);
      if (res.success) {
        setSuccessMsg(`Sales Return ${res.data.returnNumber} created successfully!`);
        setShowSalesReturnModal(false);
        setSrLines([]);
        setSrSearchedSale(null);
        setSrInvoiceSearch('');
        setSrCustomerName('');
        setSrNotes('');
        await loadData();
        setSelectedSalesReturn(res.data);
        setPrintSlipType('sales');
      } else {
        setSrModalError(res.error?.message || 'Failed to submit sales return');
      }
    } catch (err: unknown) {
      setSrModalError(err instanceof Error ? err.message : 'Error submitting sales return');
    } finally {
      setSrSubmitting(false);
    }
  };

  // Submit Purchase Return
  const handleSubmitPurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prSupplierId) {
      setPrModalError('Please select a supplier.');
      return;
    }
    if (prLines.length === 0) {
      setPrModalError('Please add at least one item to return to the supplier.');
      return;
    }

    const totalReturnMinor = prLines.reduce(
      (sum, l) => sum + Math.round(l.unitCostMinorUnits * l.quantity),
      0
    );

    const input: PostPurchaseReturnInput = {
      supplierId: prSupplierId,
      supplierInvoiceRef: prInvoiceRef.trim() || undefined,
      reason: prReason,
      settlementMethod: prSettlementMethod,
      totalAmountMinorUnits: totalReturnMinor,
      refundAmountMinorUnits: totalReturnMinor,
      processedBy: currentUserName,
      notes: prNotes.trim() || undefined,
      lines: prLines.map((l) => ({
        productVariantId: l.productVariantId,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        unitCode: l.unitCode,
        unitCostMinorUnits: l.unitCostMinorUnits,
        totalCostMinorUnits: Math.round(l.unitCostMinorUnits * l.quantity),
        sourceLocationId: l.sourceLocationId,
        lotNumber: l.lotNumber,
        reason: l.reason,
      })),
    };

    setPrSubmitting(true);
    setPrModalError(null);
    try {
      const res = await window.bakery.returns.createPurchaseReturn(input);
      if (res.success) {
        setSuccessMsg(`Purchase Return ${res.data.returnNumber} created successfully!`);
        setShowPurchaseReturnModal(false);
        setPrLines([]);
        setPrInvoiceRef('');
        setPrNotes('');
        await loadData();
        setSelectedPurchaseReturn(res.data);
        setPrintSlipType('purchase');
      } else {
        setPrModalError(res.error?.message || 'Failed to submit purchase return');
      }
    } catch (err: unknown) {
      setPrModalError(err instanceof Error ? err.message : 'Error submitting purchase return');
    } finally {
      setPrSubmitting(false);
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
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
            }}
          >
            ↩️
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
              Returns &amp; Commercial Reversals
            </h2>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Credit Notes, Customer Refunds, Stock Restocking &amp; Supplier Debit Notes
            </p>
          </div>
        </div>

        {/* Action Button & Subtabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('sales')}
              style={{
                padding: '5px 12px',
                borderRadius: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                background: activeSubTab === 'sales' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'sales' ? '#4338ca' : '#64748b',
                boxShadow: activeSubTab === 'sales' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🛒</span> Customer Returns (Credit Notes)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('purchases')}
              style={{
                padding: '5px 12px',
                borderRadius: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                background: activeSubTab === 'purchases' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'purchases' ? '#0f766e' : '#64748b',
                boxShadow: activeSubTab === 'purchases' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🚚</span> Supplier Returns (Debit Notes)
            </button>
          </div>

          {activeSubTab === 'sales' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowSalesReturnModal(true);
                setSrModalError(null);
              }}
              style={{
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
              }}
            >
              <span>+</span> New Customer Return
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowPurchaseReturnModal(true);
                setPrModalError(null);
              }}
              style={{
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              }}
            >
              <span>+</span> New Supplier Return
            </button>
          )}
        </div>
      </div>

      {/* Sleek Compact KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        <div style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.4px' }}>
              Customer Returns
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626', marginTop: '1px' }}>
              Rs. {(totalSalesReturnMinorUnits / 100).toFixed(2)}
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>
            {salesReturns.length} events
          </span>
        </div>

        <div style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.4px' }}>
              Credit Notes
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#4f46e5', marginTop: '1px' }}>
              {totalCreditNotesCount} Issued
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px' }}>
            Customer Bal
          </span>
        </div>

        <div style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.4px' }}>
              Supplier Returns
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0d9488', marginTop: '1px' }}>
              Rs. {(totalPurchaseReturnMinorUnits / 100).toFixed(2)}
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f766e', background: '#f0fdf4', padding: '2px 6px', borderRadius: '4px' }}>
            {purchaseReturns.length} sent
          </span>
        </div>

        <div style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.4px' }}>
              Debit Notes
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7', marginTop: '1px' }}>
              {totalDebitNotesCount} Deducted
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
            Payables
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: '8px', color: '#065f46', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span>
            <strong>{successMsg}</strong>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>✕</button>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <strong>{errorMsg}</strong>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      {/* Filters Strip */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={activeSubTab === 'sales' ? 'Search by CRN #, Invoice #, or Customer name...' : 'Search by DBN #, Supplier name, or Ref...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
          style={{ maxWidth: '380px', fontSize: '13px', padding: '8px 12px' }}
        />

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="form-select"
          style={{ width: '180px', fontSize: '13px', padding: '8px 12px' }}
        >
          <option value="all">All Settlement Methods</option>
          {activeSubTab === 'sales' ? (
            <>
              <option value="CREDIT_NOTE">Credit Note (Balance)</option>
              <option value="CASH_REFUND">Cash Refund</option>
              <option value="BANK_REFUND">Bank Refund</option>
              <option value="NO_REFUND">No Refund (Exchange)</option>
            </>
          ) : (
            <>
              <option value="DEBIT_NOTE">Debit Note (Payables)</option>
              <option value="CASH_REFUND">Cash Refund</option>
              <option value="BANK_REFUND">Bank Refund</option>
            </>
          )}
        </select>

        <button
          type="button"
          className="btn-secondary"
          onClick={loadData}
          disabled={loading}
          style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* SUBTAB 1: CUSTOMER SALES RETURNS TABLE */}
      {activeSubTab === 'sales' && (
        <div className="panel-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Return # (CRN)</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Original Invoice</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Reason</th>
                <th style={{ textAlign: 'center', padding: '12px 12px' }}>Method</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Refund Total</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesReturns
                .filter((r) => {
                  const matchSearch =
                    !searchTerm.trim() ||
                    r.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (r.originalInvoiceNumber && r.originalInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (r.customerName && r.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
                  const matchMethod = methodFilter === 'all' || r.refundMethod === methodFilter;
                  return matchSearch && matchMethod;
                })
                .map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#4338ca' }}>
                      {r.returnNumber}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                      {new Date(r.returnDateUtc).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 600 }}>
                      {r.originalInvoiceNumber || 'Walk-in (Direct)'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {r.customerName || 'Walk-in Customer'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {r.reason}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            r.refundMethod === 'CREDIT_NOTE'
                              ? '#e0e7ff'
                              : r.refundMethod === 'CASH_REFUND'
                              ? '#fef2f2'
                              : '#ecfdf5',
                          color:
                            r.refundMethod === 'CREDIT_NOTE'
                              ? '#3730a3'
                              : r.refundMethod === 'CASH_REFUND'
                              ? '#991b1b'
                              : '#065f46',
                        }}
                      >
                        {r.refundMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                      Rs. {(r.refundAmountMinorUnits / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setSelectedSalesReturn(r);
                          setPrintSlipType('sales');
                        }}
                        style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 600 }}
                      >
                        📄 View Slip
                      </button>
                    </td>
                  </tr>
                ))}

              {salesReturns.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛒</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>No Sales Returns Recorded</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Click "+ New Customer Return" to issue a Credit Note or refund.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 2: SUPPLIER PURCHASE RETURNS TABLE */}
      {activeSubTab === 'purchases' && (
        <div className="panel-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Debit Note # (DBN)</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Supplier</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Invoice / GRN Ref</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Reason</th>
                <th style={{ textAlign: 'center', padding: '12px 12px' }}>Method</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Debit Total</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturns
                .filter((r) => {
                  const matchSearch =
                    !searchTerm.trim() ||
                    r.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (r.supplierName && r.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (r.supplierInvoiceRef && r.supplierInvoiceRef.toLowerCase().includes(searchTerm.toLowerCase()));
                  const matchMethod = methodFilter === 'all' || r.settlementMethod === methodFilter;
                  return matchSearch && matchMethod;
                })
                .map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f766e' }}>
                      {r.returnNumber}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                      {new Date(r.returnDateUtc).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 700 }}>
                      {r.supplierName || `Supplier #${r.supplierId}`}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {r.supplierInvoiceRef || 'Direct Stock Return'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {r.reason}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: r.settlementMethod === 'DEBIT_NOTE' ? '#ccfbf1' : '#f0fdf4',
                          color: r.settlementMethod === 'DEBIT_NOTE' ? '#115e59' : '#166534',
                        }}
                      >
                        {r.settlementMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f766e' }}>
                      Rs. {(r.refundAmountMinorUnits / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setSelectedPurchaseReturn(r);
                          setPrintSlipType('purchase');
                        }}
                        style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 600 }}
                      >
                        📄 View Slip
                      </button>
                    </td>
                  </tr>
                ))}

              {purchaseReturns.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🚚</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>No Supplier Returns Recorded</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Click "+ New Supplier Return" to return goods and generate Debit Notes.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: NEW CUSTOMER SALES RETURN (CREDIT NOTE) */}
      {showSalesReturnModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '780px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🛒</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Customer Sales Return &amp; Credit Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSalesReturnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {srModalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', color: '#991b1b', fontSize: '12px', marginBottom: '14px' }}>
                {srModalError}
              </div>
            )}

            <form onSubmit={handleSubmitSalesReturn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Step 1: Search Original Invoice or Select Customer */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Step 1: Link Sales Invoice (Optional for Walk-In Returns)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter Invoice # (e.g. INV-20261016-0001)..."
                    value={srInvoiceSearch}
                    onChange={(e) => setSrInvoiceSearch(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSearchSale}
                    disabled={srSearchingSale}
                    style={{ fontWeight: 700, fontSize: '12px' }}
                  >
                    {srSearchingSale ? 'Searching...' : '🔍 Fetch Items'}
                  </button>
                </div>
                {srSearchedSale && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                    ✓ Invoice Found! Total: Rs. {(srSearchedSale.totalMinorUnits / 100).toFixed(2)} · Customer: {srSearchedSale.customerName || 'Walk-In'}
                  </div>
                )}
              </div>

              {/* Step 2: Customer & Refund Method Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Customer</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      list="sr-customers-list"
                      placeholder="Walk-In Customer"
                      value={srCustomerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSrCustomerName(val);
                        const matched = customers.find((c) => c.name.toLowerCase() === val.toLowerCase());
                        setSrCustomerId(matched?.id);
                      }}
                      className="form-input"
                      style={{ flex: 1, fontSize: '13px' }}
                    />
                    <datalist id="sr-customers-list">
                      {customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.companyName ? `${c.name} (${c.companyName})` : c.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Refund Resolution</label>
                  <select
                    value={srRefundMethod}
                    onChange={(e) => setSrRefundMethod(e.target.value as any)}
                    className="form-select"
                    style={{ fontSize: '13px' }}
                  >
                    <option value="CREDIT_NOTE">Credit Note (Deduct from Customer Balance)</option>
                    <option value="CASH_REFUND">Cash Payout (From Active Drawer)</option>
                    <option value="BANK_REFUND">Bank Transfer Refund</option>
                    <option value="NO_REFUND">No Refund (Direct Item Replacement)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Primary Return Reason</label>
                  <select
                    value={srReason}
                    onChange={(e) => setSrReason(e.target.value)}
                    className="form-select"
                    style={{ fontSize: '13px' }}
                  >
                    <option value="Defective / Quality Issue">Defective / Quality Issue</option>
                    <option value="Expired Product">Expired Product</option>
                    <option value="Wrong Item Dispatched">Wrong Item Dispatched</option>
                    <option value="Damaged Packaging">Damaged Packaging</option>
                    <option value="Customer Changed Mind">Customer Changed Mind</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Line Items to Return */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                    Step 2: Items to Return &amp; Stock Disposition
                  </label>
                  {/* Manual add picker if not linked to invoice */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddManualSalesReturnLine(parseInt(e.target.value, 10));
                        e.target.value = '';
                      }
                    }}
                    className="form-select"
                    style={{ width: '220px', fontSize: '12px' }}
                  >
                    <option value="">+ Add Product Manually...</option>
                    {products.map((p) => (
                      <option key={p.variantId} value={p.variantId}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px' }}>Product</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', width: '90px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', width: '100px' }}>Unit Price</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', width: '140px' }}>Disposition</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', width: '140px' }}>Target Loc</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', width: '90px' }}>Total</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {srLines.map((line, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                            {line.productName}
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>{line.sku}</div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              max={line.maxQuantity}
                              value={line.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setSrLines((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                                );
                              }}
                              className="form-input"
                              style={{ width: '70px', textAlign: 'center', padding: '4px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            Rs. {(line.unitPriceMinorUnits / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <select
                              value={line.condition}
                              onChange={(e) => {
                                const cond = e.target.value as 'RESTOCK' | 'DAMAGED_SCRAP';
                                setSrLines((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, condition: cond } : item))
                                );
                              }}
                              className="form-select"
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: line.condition === 'RESTOCK' ? '#047857' : '#b91c1c',
                              }}
                            >
                              <option value="RESTOCK">Restock (Sellable)</option>
                              <option value="DAMAGED_SCRAP">Damaged (Scrap)</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <select
                              value={line.targetLocationId}
                              onChange={(e) => {
                                const locId = parseInt(e.target.value, 10);
                                setSrLines((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, targetLocationId: locId } : item))
                                );
                              }}
                              disabled={line.condition === 'DAMAGED_SCRAP'}
                              className="form-select"
                              style={{ padding: '4px 6px', fontSize: '11px' }}
                            >
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            Rs. {((line.unitPriceMinorUnits * line.quantity) / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setSrLines((prev) => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}

                      {srLines.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                            No items added. Fetch from invoice above or add products manually.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Notes */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <input
                  type="text"
                  placeholder="Optional notes or customer explanation..."
                  value={srNotes}
                  onChange={(e) => setSrNotes(e.target.value)}
                  className="form-input"
                  style={{ maxWidth: '380px', fontSize: '12px' }}
                />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Credit / Refund Amount
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>
                    Rs. {(srLines.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSalesReturnModal(false)}
                  disabled={srSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={srSubmitting || srLines.length === 0}
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #4338ca)', fontWeight: 700 }}
                >
                  {srSubmitting ? 'Posting Return...' : 'Confirm Return & Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW SUPPLIER PURCHASE RETURN (DEBIT NOTE) */}
      {showPurchaseReturnModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '780px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🚚</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Supplier Purchase Return &amp; Debit Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseReturnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {prModalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', color: '#991b1b', fontSize: '12px', marginBottom: '14px' }}>
                {prModalError}
              </div>
            )}

            <form onSubmit={handleSubmitPurchaseReturn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Step 1: Supplier & Settlement Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Select Supplier *</label>
                  <select
                    value={prSupplierId || ''}
                    onChange={(e) => setPrSupplierId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="form-select"
                    style={{ fontSize: '13px' }}
                    required
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Bal: Rs. {(s.outstandingBalanceMinorUnits / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Supplier Bill / GRN Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. GRN-001 / BILL-992"
                    value={prInvoiceRef}
                    onChange={(e) => setPrInvoiceRef(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Settlement Method</label>
                  <select
                    value={prSettlementMethod}
                    onChange={(e) => setPrSettlementMethod(e.target.value as any)}
                    className="form-select"
                    style={{ fontSize: '13px' }}
                  >
                    <option value="DEBIT_NOTE">Debit Note (Deduct from Payable Debt)</option>
                    <option value="CASH_REFUND">Cash Refund Received</option>
                    <option value="BANK_REFUND">Bank Refund</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Primary Return Reason</label>
                  <select
                    value={prReason}
                    onChange={(e) => setPrReason(e.target.value)}
                    className="form-select"
                    style={{ fontSize: '13px' }}
                  >
                    <option value="Damaged / Rejected Delivery">Damaged / Rejected Delivery</option>
                    <option value="Quality Inspection Failed">Quality Inspection Failed</option>
                    <option value="Short Expiry Received">Short Expiry Received</option>
                    <option value="Excess Quantity Sent">Excess Quantity Sent</option>
                    <option value="Incorrect Specifications">Incorrect Specifications</option>
                  </select>
                </div>
              </div>

              {/* Step 2: Add Items Strip */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Add Products to Return from Warehouse
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr auto', gap: '8px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Product</label>
                    <select
                      value={prSelectedVariantId}
                      onChange={(e) => {
                        const vid = parseInt(e.target.value, 10);
                        setPrSelectedVariantId(vid);
                        const prod = products.find((p) => p.variantId === vid);
                        if (prod) {
                          setPrItemCostRs((prod.costMinorUnits / 100).toFixed(2));
                        }
                      }}
                      className="form-select"
                      style={{ fontSize: '12px' }}
                    >
                      <option value="0">-- Select Product --</option>
                      {products.map((p) => (
                        <option key={p.variantId} value={p.variantId}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Qty</label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={prItemQty}
                      onChange={(e) => setPrItemQty(parseFloat(e.target.value) || 1)}
                      className="form-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Cost Rs</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prItemCostRs}
                      onChange={(e) => setPrItemCostRs(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Deduct From Location</label>
                    <select
                      value={prItemSourceLocId}
                      onChange={(e) => setPrItemSourceLocId(parseInt(e.target.value, 10))}
                      className="form-select"
                      style={{ fontSize: '12px' }}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Return Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Expired / Damaged"
                      value={prItemReason}
                      onChange={(e) => setPrItemReason(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddPurchaseReturnLine}
                    disabled={!prSelectedVariantId}
                    style={{ padding: '7px 14px', fontSize: '12px', background: '#0d9488' }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Table of Return Lines */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Product</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Cost Unit</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px' }}>Source Loc</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prLines.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                          {line.productName}
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>{line.sku}</div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {line.quantity} {line.unitCode}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          Rs. {(line.unitCostMinorUnits / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>
                          {locations.find((l) => l.id === line.sourceLocationId)?.name || 'Central WH'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>
                          Rs. {((line.unitCostMinorUnits * line.quantity) / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setPrLines((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}

                    {prLines.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                          No products added to return yet. Select a product above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total & Notes */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <input
                  type="text"
                  placeholder="Notes / supplier return explanation..."
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  className="form-input"
                  style={{ maxWidth: '380px', fontSize: '12px' }}
                />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Debit Note Value
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f766e' }}>
                    Rs. {(prLines.reduce((s, l) => s + l.unitCostMinorUnits * l.quantity, 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPurchaseReturnModal(false)}
                  disabled={prSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={prSubmitting || prLines.length === 0}
                  style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', fontWeight: 700 }}
                >
                  {prSubmitting ? 'Posting Return...' : 'Confirm Return & Issue Debit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINT SLIP MODAL (CREDIT NOTE / DEBIT NOTE) */}
      {printSlipType && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📄</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {printSlipType === 'sales' ? 'Credit Note Voucher (CRN)' : 'Debit Note Voucher (DBN)'}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSlipFormat('commercial')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '4px',
                      background: slipFormat === 'commercial' ? '#ffffff' : 'transparent',
                      color: slipFormat === 'commercial' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    A4 / Commercial
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlipFormat('thermal')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '4px',
                      background: slipFormat === 'thermal' ? '#ffffff' : 'transparent',
                      color: slipFormat === 'thermal' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Thermal 80mm
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintSlipType(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Slip Container */}
            <div
              id="printable-return-slip"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: slipFormat === 'thermal' ? '12px' : '24px',
                maxWidth: slipFormat === 'thermal' ? '320px' : '100%',
                margin: '0 auto',
                fontFamily: 'monospace, sans-serif',
                fontSize: slipFormat === 'thermal' ? '11px' : '12.5px',
                lineHeight: 1.4,
              }}
            >
              {/* Slip Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #0f172a', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}>
                  RZ ENTERPRISES
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Head Office &amp; Central Distribution, Lahore
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '8px', color: printSlipType === 'sales' ? '#4338ca' : '#0f766e', textTransform: 'uppercase' }}>
                  {printSlipType === 'sales' ? '★ CREDIT NOTE VOUCHER ★' : '★ DEBIT NOTE VOUCHER ★'}
                </div>
              </div>

              {/* Document Meta Info */}
              {printSlipType === 'sales' && selectedSalesReturn && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Credit Note #:</span>
                    <strong>{selectedSalesReturn.returnNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Date &amp; Time:</span>
                    <span>{new Date(selectedSalesReturn.returnDateUtc).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Original Invoice:</span>
                    <strong>{selectedSalesReturn.originalInvoiceNumber || 'Walk-In'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Customer:</span>
                    <span>{selectedSalesReturn.customerName || 'Walk-In Customer'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Refund Method:</span>
                    <strong style={{ color: '#4338ca' }}>{selectedSalesReturn.refundMethod.replace('_', ' ')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Processed By:</span>
                    <span>{selectedSalesReturn.processedBy}</span>
                  </div>

                  {/* Lines Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a', margin: '8px 0' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px dashed #64748b' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Price</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSalesReturn.lines?.map((line, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 0' }}>
                            {line.productName}
                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                              [{line.condition === 'RESTOCK' ? 'RESTOCKED' : 'SCRAPPED'}]
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 0' }}>{line.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>{(line.unitPriceMinorUnits / 100).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>
                            {((line.unitPriceMinorUnits * line.quantity) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, marginTop: '8px', borderBottom: '1px dashed #64748b', paddingBottom: '8px' }}>
                    <span>TOTAL REFUND AMOUNT:</span>
                    <span>Rs. {(selectedSalesReturn.refundAmountMinorUnits / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {printSlipType === 'purchase' && selectedPurchaseReturn && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Debit Note #:</span>
                    <strong>{selectedPurchaseReturn.returnNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Date &amp; Time:</span>
                    <span>{new Date(selectedPurchaseReturn.returnDateUtc).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Supplier:</span>
                    <strong>{selectedPurchaseReturn.supplierName || `Supplier #${selectedPurchaseReturn.supplierId}`}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Supplier Bill Ref:</span>
                    <span>{selectedPurchaseReturn.supplierInvoiceRef || 'Direct WH Return'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Settlement:</span>
                    <strong style={{ color: '#0f766e' }}>{selectedPurchaseReturn.settlementMethod.replace('_', ' ')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Authorized By:</span>
                    <span>{selectedPurchaseReturn.processedBy}</span>
                  </div>

                  {/* Lines Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a', margin: '8px 0' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px dashed #64748b' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Cost</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPurchaseReturn.lines?.map((line, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 0' }}>
                            {line.productName}
                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>[From WH]</div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 0' }}>{line.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>{(line.unitCostMinorUnits / 100).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>
                            {((line.unitCostMinorUnits * line.quantity) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, marginTop: '8px', borderBottom: '1px dashed #64748b', paddingBottom: '8px' }}>
                    <span>TOTAL DEBIT AMOUNT:</span>
                    <span>Rs. {(selectedPurchaseReturn.refundAmountMinorUnits / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Signatures & Footer */}
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', paddingTop: '16px', fontSize: '10.5px' }}>
                <div style={{ textAlign: 'center', width: '45%', borderTop: '1px solid #94a3b8', paddingTop: '4px' }}>
                  Customer / Supplier Signature
                </div>
                <div style={{ textAlign: 'center', width: '45%', borderTop: '1px solid #94a3b8', paddingTop: '4px' }}>
                  Authorized Manager Sign &amp; Stamp
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#94a3b8', marginTop: '16px' }}>
                Official RZ Enterprises ERP System Generated Record · Local-First
              </div>
            </div>

            {/* Print Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPrintSlipType(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <span>🖨️</span> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
