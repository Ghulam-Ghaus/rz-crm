import React, { useState, useEffect, useCallback } from 'react';
import type { StockBalanceItem, StockMovementLogItem } from '@rz-crm/contracts';

interface InventoryTabProps {
  storeId?: number;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ storeId = 1 }) => {
  const [balances, setBalances] = useState<StockBalanceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [selectedItem, setSelectedItem] = useState<StockBalanceItem | null>(null);
  const [movements, setMovements] = useState<StockMovementLogItem[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Negative Inventory Policy State (Option 3 Toggle)
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(false);
  const [savingSetting, setSavingSetting] = useState<boolean>(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);

  // Quick Stock Adjustment / Count Modal State
  const [adjustItem, setAdjustItem] = useState<StockBalanceItem | null>(null);
  const [newCountQty, setNewCountQty] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Physical Inventory Count & True-Up');
  const [savingAdjust, setSavingAdjust] = useState<boolean>(false);

  // Load store settings for policy toggle
  const loadPolicySetting = useCallback(async () => {
    try {
      const res = await window.bakery.system.getSettings(storeId);
      if (res.success && res.data) {
        const found = res.data.find((s) => s.key === 'allow_negative_stock');
        setAllowNegativeStock(found?.value === 'true');
      }
    } catch (e) {
      console.error('Failed to load store settings:', e);
    }
  }, [storeId]);

  useEffect(() => {
    loadPolicySetting();
  }, [loadPolicySetting]);

  const handleToggleNegativeStock = async () => {
    setSavingSetting(true);
    setPolicyMessage(null);
    try {
      const nextVal = !allowNegativeStock;
      const res = await window.bakery.system.setSetting({
        key: 'allow_negative_stock',
        value: String(nextVal),
        storeId,
        description: 'Whether POS sales are permitted to drive inventory balance below zero.',
      });
      if (res.success) {
        setAllowNegativeStock(nextVal);
        setPolicyMessage(
          nextVal
            ? 'Policy updated: POS sales are now permitted even if stock is 0 (logged as audit exceptions).'
            : 'Policy updated: POS sales will now be strictly blocked when stock is 0.'
        );
        setTimeout(() => setPolicyMessage(null), 5000);
      } else {
        alert(res.error.message || 'Failed to update policy setting');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setSavingSetting(false);
    }
  };

  const handleOpenAdjust = (item: StockBalanceItem) => {
    setAdjustItem(item);
    setNewCountQty(item.onHandQuantity < 0 ? '0' : String(item.onHandQuantity));
    setAdjustReason('Physical Inventory Count & True-Up');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const qty = parseFloat(newCountQty);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid non-negative physical count quantity.');
      return;
    }

    setSavingAdjust(true);
    try {
      const res = await window.bakery.inventory.adjustStock({
        storeId,
        itemId: adjustItem.itemId,
        newQuantity: qty,
        reason: adjustReason.trim() || 'Physical Inventory Count & True-Up',
      });
      if (res.success) {
        setAdjustItem(null);
        setNewCountQty('');
        await loadBalances();
      } else {
        alert(res.error.message || 'Failed to post adjustment');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error posting adjustment');
    } finally {
      setSavingAdjust(false);
    }
  };

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.bakery.inventory.getStockBalances({
        storeId,
        search: search.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      if (res.success) {
        setBalances(res.data);
      } else {
        setErrorMsg(res.error.message || 'Failed to load stock balances');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading stock');
    } finally {
      setLoading(false);
    }
  }, [storeId, search, statusFilter]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Open movement audit history for an item
  const openMovementsModal = async (item: StockBalanceItem) => {
    setSelectedItem(item);
    setLoadingMovements(true);
    try {
      const res = await window.bakery.inventory.getMovements(storeId, item.itemId);
      if (res.success && res.data) {
        setMovements(res.data);
      } else {
        setMovements([]);
      }
    } catch {
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Filtered balances by search query and status filter
  const filteredBalances = balances.filter((item) => {
    // 1. Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    // 2. Search query filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const nameMatch = item.itemName.toLowerCase().includes(q);
      const skuMatch = item.sku.toLowerCase().includes(q);
      const barcodeMatch = item.barcode ? item.barcode.toLowerCase().includes(q) : false;
      const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
      const locMatch = item.locationName ? item.locationName.toLowerCase().includes(q) : false;
      if (!nameMatch && !skuMatch && !barcodeMatch && !catMatch && !locMatch) {
        return false;
      }
    }
    return true;
  });

  // Export stock balance list as CSV
  const handleExportCsv = () => {
    const listToExport = filteredBalances.length > 0 ? filteredBalances : balances;
    if (listToExport.length === 0) return;
    const headers = ['Item Name', 'Category', 'SKU', 'Barcode', 'Location', 'On Hand Quantity', 'Base Unit', 'Status'];
    const rows = listToExport.map((b) => [
      `"${b.itemName.replace(/"/g, '""')}"`,
      `"${(b.categoryName || '').replace(/"/g, '""')}"`,
      `"${b.sku}"`,
      `"${b.barcode || ''}"`,
      `"${b.locationName || ''}"`,
      b.onHandQuantity,
      b.baseUnitCode,
      b.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bakery-stock-balances-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const totalItems = balances.length;
  const inStockCount = balances.filter((b) => b.status === 'in_stock').length;
  const lowStockCount = balances.filter((b) => b.status === 'low_stock').length;
  const outOfStockCount = balances.filter((b) => b.status === 'out_of_stock').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', background: '#f1f5f9', padding: '10px', borderRadius: '10px' }}>📦</div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Tracked
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalItems}</div>
          </div>
        </div>

        <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', background: '#ecfdf5', padding: '10px', borderRadius: '10px' }}>🟢</div>
          <div>
            <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
              In Stock
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857' }}>{inStockCount}</div>
          </div>
        </div>

        <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', background: '#fffbeb', padding: '10px', borderRadius: '10px' }}>🟡</div>
          <div>
            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>
              Low Stock (&le;10)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309' }}>{lowStockCount}</div>
          </div>
        </div>

        <div className="panel-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', background: '#fef2f2', padding: '10px', borderRadius: '10px' }}>🔴</div>
          <div>
            <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>
              Out of Stock
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c' }}>{outOfStockCount}</div>
          </div>
        </div>
      </div>

      {/* Store Negative Inventory Policy Setting Card (Option 3 Toggle) */}
      <div
        className="panel-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: allowNegativeStock
            ? 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)'
            : 'linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)',
          border: allowNegativeStock ? '1px solid #fde68a' : '1px solid #bbf7d0',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '300px' }}>
          <div
            style={{
              fontSize: '24px',
              background: allowNegativeStock ? '#fef3c7' : '#dcfce7',
              padding: '10px',
              borderRadius: '10px',
              border: allowNegativeStock ? '1px solid #fde68a' : '1px solid #86efac',
            }}
          >
            {allowNegativeStock ? '⚠️' : '🛡️'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '13.5px', color: allowNegativeStock ? '#92400e' : '#166534' }}>
                POS Out-of-Stock Sales Policy:
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: allowNegativeStock ? '#f59e0b' : '#16a34a',
                  color: '#ffffff',
                }}
              >
                {allowNegativeStock ? 'PERMISSIVE (Allowed)' : 'STRICT GUARD (Blocked)'}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: allowNegativeStock ? '#b45309' : '#15803d', marginTop: '3px', lineHeight: 1.4 }}>
              {allowNegativeStock
                ? 'Cashiers CAN sell items even if stock is 0 or negative. Balances go into negative and are logged as audit exceptions.'
                : 'Cashiers CANNOT complete sales for items with 0 or insufficient stock. Prevents negative balances and enforces receiving/production logging.'}
            </div>
            {policyMessage && (
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
                ✓ {policyMessage}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={savingSetting}
          onClick={handleToggleNegativeStock}
          style={{
            padding: '10px 18px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px',
            cursor: savingSetting ? 'not-allowed' : 'pointer',
            border: 'none',
            background: allowNegativeStock ? '#92400e' : '#15803d',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>{allowNegativeStock ? '🔒' : '🔓'}</span>
          <span>{savingSetting ? 'Saving...' : allowNegativeStock ? 'Switch to Strict Blocking' : 'Allow Out-of-Stock Sales'}</span>
        </button>
      </div>

      {/* Main Stock Table Panel */}
      <div className="panel-card">
        {/* Filter & Action Toolbar */}
        <div
          className="panel-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            <span className="panel-title">Live Inventory Ledger Balances</span>
            <span className="panel-badge ok">
              {filteredBalances.length === balances.length
                ? `${balances.length} items`
                : `${filteredBalances.length} of ${balances.length} items`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search product, SKU, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ width: '220px', height: '34px', fontSize: '12px' }}
            />

            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
              {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    borderRight: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: statusFilter === st ? '#0284c7' : '#ffffff',
                    color: statusFilter === st ? '#ffffff' : '#475569',
                    textTransform: 'capitalize',
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}
              title="Export stock count sheet to CSV"
            >
              📥 Export CSV
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={loadBalances}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Refresh stock ledger"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: '12px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Stock Balances Table */}
        <div className="panel-body" style={{ padding: 0, maxHeight: '560px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              Calculating live inventory balances from ledger...
            </div>
          ) : balances.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>No Stock Records Found</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Run an Opening Stock session or post a Purchase Order GRN to initialize quantities.
              </div>
            </div>
          ) : filteredBalances.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>No Matching Items Found</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                No stock balance matches "{search}"{statusFilter !== 'all' ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}.
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '12px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                Clear Search &amp; Filters
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Item Name</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Barcode</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Location</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>On Hand Qty</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Ledger Trail</th>
                </tr>
              </thead>
              <tbody>
                {filteredBalances.map((item) => {
                  const isOut = item.status === 'out_of_stock';
                  const isLow = item.status === 'low_stock';
                  return (
                    <tr key={item.itemId} style={{ background: isOut ? '#fef2f2' : undefined }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.itemName}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.categoryName}</td>
                      <td className="value" style={{ textAlign: 'left', padding: '10px 12px' }}>{item.sku}</td>
                      <td className="value" style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b' }}>
                        {item.barcode || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.locationName}</td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669',
                        }}
                      >
                        {item.onHandQuantity} <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.baseUnitCode}</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
                            color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                          }}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleOpenAdjust(item)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: item.onHandQuantity < 0 ? '#b91c1c' : '#0369a1',
                              borderColor: item.onHandQuantity < 0 ? '#fca5a5' : '#bae6fd',
                              background: item.onHandQuantity < 0 ? '#fff1f2' : '#f0f9ff',
                            }}
                          >
                            ⚡ Count / True-Up
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openMovementsModal(item)}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
                          >
                            📜 Audit Trail
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

      {/* Movement Audit Drawer / Modal */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Stock Ledger Trail: {selectedItem.itemName}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  SKU: {selectedItem.sku} | Current On Hand: <strong>{selectedItem.onHandQuantity} {selectedItem.baseUnitCode}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {loadingMovements ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading ledger movements...</div>
              ) : movements.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No historical ledger movements found for this item.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date / Time (UTC)</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Source Reference</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const isPositive = m.signedBaseQuantity > 0;
                      return (
                        <tr key={m.id}>
                          <td className="value" style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px' }}>
                            {m.occurredAtUtc ? m.occurredAtUtc.replace('T', ' ').slice(0, 19) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                background: m.movementType === 'OPENING' ? '#e0f2fe' : m.movementType === 'SALE' ? '#fef2f2' : '#ecfdf5',
                                color: m.movementType === 'OPENING' ? '#0369a1' : m.movementType === 'SALE' ? '#b91c1c' : '#047857',
                              }}
                            >
                              {m.movementType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '12px' }}>
                            {m.sourceType ? `${m.sourceType} (#${m.sourceId || '—'})` : '—'}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: isPositive ? '#059669' : '#dc2626',
                            }}
                          >
                            {isPositive ? `+${m.signedBaseQuantity}` : m.signedBaseQuantity} {selectedItem.baseUnitCode}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedItem(null)}
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stock Count & True-Up Modal */}
      {adjustItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !savingAdjust && setAdjustItem(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Quick Stock Count &amp; True-Up
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !savingAdjust && setAdjustItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAdjustment} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {adjustItem.itemName}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  SKU: {adjustItem.sku} | Location: {adjustItem.locationName}
                </div>
              </div>

              {/* Current Ledger vs New Count */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Current Ledger
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: adjustItem.onHandQuantity < 0 ? '#dc2626' : '#059669',
                      marginTop: '2px',
                    }}
                  >
                    {adjustItem.onHandQuantity} {adjustItem.baseUnitCode}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Calculated Variance
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0284c7',
                      marginTop: '2px',
                    }}
                  >
                    {(() => {
                      const n = parseFloat(newCountQty);
                      if (isNaN(n)) return '—';
                      const diff = n - adjustItem.onHandQuantity;
                      return `${diff >= 0 ? '+' : ''}${diff} ${adjustItem.baseUnitCode}`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Input New Verified Physical Count */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Actual Physical Shelf Count ({adjustItem.baseUnitCode}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="form-input"
                  value={newCountQty}
                  onChange={(e) => setNewCountQty(e.target.value)}
                  placeholder="Enter current real physical count..."
                  autoFocus
                  required
                  style={{ fontSize: '16px', fontWeight: 700, padding: '10px 12px' }}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  The system will write an immutable <code>ADJUSTMENT</code> ledger movement to true-up the balance.
                </div>
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Adjustment Reason *
                </label>
                <select
                  className="form-input"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                >
                  <option value="Physical Inventory Count & True-Up">Physical Inventory Count &amp; True-Up</option>
                  <option value="Kitchen Production Batch Recorded Belatedly">Kitchen Production Batch Recorded Belatedly</option>
                  <option value="Supplier Receiving Not In System">Supplier Receiving Not In System</option>
                  <option value="Opening Stock Balance Setup">Opening Stock Balance Setup</option>
                  <option value="Damage / Spoilage True-Up">Damage / Spoilage True-Up</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={savingAdjust}
                  onClick={() => setAdjustItem(null)}
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingAdjust || !newCountQty}
                  style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 700 }}
                >
                  {savingAdjust ? 'Posting Adjustment...' : 'Confirm & Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
