import React, { useState, useEffect, useCallback } from 'react';
import {
  ProfitLossReport,
  Category,
  ProductListItem,
  Supplier,
  Store,
} from '@bakery/contracts';

interface ProfitLossTabProps {
  store: Store | null;
  categories: Category[];
  products: ProductListItem[];
  suppliers: Supplier[];
}

export const ProfitLossTab: React.FC<ProfitLossTabProps> = ({
  store,
  categories,
  products,
  suppliers,
}) => {
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Timeframe presets
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'profit' | 'revenue' | 'units' | 'margin'>('profit');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Load report
  const loadReport = useCallback(async () => {
    if (!store || !window.bakery?.reports?.getProfitLoss) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let startDateUtc: string | undefined;
      let endDateUtc: string | undefined;
      const now = new Date();

      if (timeframe === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        startDateUtc = start.toISOString();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        endDateUtc = end.toISOString();
      } else if (timeframe === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        startDateUtc = monday.toISOString();
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        endDateUtc = sunday.toISOString();
      } else if (timeframe === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        startDateUtc = firstDay.toISOString();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        endDateUtc = lastDay.toISOString();
      } else if (timeframe === 'year') {
        const firstDayYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        startDateUtc = firstDayYear.toISOString();
        const lastDayYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        endDateUtc = lastDayYear.toISOString();
      } else if (timeframe === 'custom') {
        if (customStartDate) {
          startDateUtc = new Date(`${customStartDate}T00:00:00`).toISOString();
        }
        if (customEndDate) {
          endDateUtc = new Date(`${customEndDate}T23:59:59`).toISOString();
        }
      }

      const res = await window.bakery.reports.getProfitLoss({
        storeId: store.id,
        startDateUtc,
        endDateUtc,
        categoryId: selectedCategoryId ? parseInt(selectedCategoryId, 10) : undefined,
        variantId: selectedVariantId ? parseInt(selectedVariantId, 10) : undefined,
        supplierId: selectedSupplierId ? parseInt(selectedSupplierId, 10) : undefined,
      });

      if (res.success) {
        setReport(res.data);
      } else {
        setErrorMsg(res.error.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [store, timeframe, customStartDate, customEndDate, selectedCategoryId, selectedVariantId, selectedSupplierId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Export CSV Handler
  const handleExportCsv = async () => {
    if (!report || !window.bakery?.reports?.exportFile) return;

    let csv = 'Product Name,SKU,Category,Units Sold,Avg Sell Price (Rs),Unit Cost (Rs),Total Revenue (Rs),Total Cost (Rs),Gross Profit (Rs),Margin %\n';
    for (const it of report.items) {
      const sellRs = (it.avgSellPriceMinorUnits / 100).toFixed(2);
      const costRs = (it.avgCostPriceMinorUnits / 100).toFixed(2);
      const revRs = (it.totalRevenueMinorUnits / 100).toFixed(2);
      const totalCostRs = (it.totalCostMinorUnits / 100).toFixed(2);
      const profitRs = (it.grossProfitMinorUnits / 100).toFixed(2);
      csv += `"${it.productName.replace(/"/g, '""')}","${it.sku}","${it.categoryName || ''}",${it.unitsSold},${sellRs},${costRs},${revRs},${totalCostRs},${profitRs},${it.marginPercent}%\n`;
    }

    const totalRev = (report.totalRevenueMinorUnits / 100).toFixed(2);
    const totalCost = (report.totalCostMinorUnits / 100).toFixed(2);
    const totalProfit = (report.grossProfitMinorUnits / 100).toFixed(2);
    csv += `\n"TOTALS","","",${report.totalUnitsSold},"","",${totalRev},${totalCost},${totalProfit},${report.profitMarginPercent}%\n`;

    await window.bakery.reports.exportFile({
      suggestedFilename: `Profit_Loss_Report_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      format: 'csv',
      title: 'Export Profit & Loss Statement (Excel/CSV)',
    });
  };

  // Filtered & sorted items
  const items = (report?.items || []).filter((it) => {
    if (!itemSearchQuery.trim()) return true;
    const q = itemSearchQuery.toLowerCase();
    return (
      it.productName.toLowerCase().includes(q) ||
      it.sku.toLowerCase().includes(q) ||
      (it.categoryName && it.categoryName.toLowerCase().includes(q))
    );
  });

  items.sort((a, b) => {
    let diff = 0;
    if (sortField === 'profit') diff = a.grossProfitMinorUnits - b.grossProfitMinorUnits;
    else if (sortField === 'revenue') diff = a.totalRevenueMinorUnits - b.totalRevenueMinorUnits;
    else if (sortField === 'units') diff = a.unitsSold - b.unitsSold;
    else if (sortField === 'margin') diff = a.marginPercent - b.marginPercent;
    return sortAsc ? diff : -diff;
  });

  const totalRevRs = ((report?.totalRevenueMinorUnits || 0) / 100).toFixed(2);
  const totalCostRs = ((report?.totalCostMinorUnits || 0) / 100).toFixed(2);
  const grossProfitRs = ((report?.grossProfitMinorUnits || 0) / 100).toFixed(2);
  const isProfitable = (report?.grossProfitMinorUnits || 0) >= 0;

  const totalOpexRs = ((report?.totalOperatingExpensesMinorUnits || 0) / 100).toFixed(2);
  const totalPayrollRs = ((report?.totalPayrollMinorUnits || 0) / 100).toFixed(2);
  const totalAdvancesRs = ((report?.totalAdvancesMinorUnits || 0) / 100).toFixed(2);
  const totalStaffCostMinor = (report?.totalPayrollMinorUnits || 0) + (report?.totalAdvancesMinorUnits || 0);
  const totalStaffCostRs = (totalStaffCostMinor / 100).toFixed(2);
  const netProfitRs = ((report?.netProfitMinorUnits || 0) / 100).toFixed(2);
  const isNetProfitable = (report?.netProfitMinorUnits || 0) >= 0;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Filter & Timeframe Controls */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          {/* Timeframe Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginRight: '4px' }}>
              📅 Period:
            </span>
            {[
              { id: 'today', label: 'Today (Closing Day)' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab-btn ${timeframe === t.id ? 'active' : ''}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: timeframe === t.id ? 700 : 500,
                }}
                onClick={() => setTimeframe(t.id as any)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportCsv}
              disabled={loading || !report || report.items.length === 0}
            >
              📥 Export to CSV / Excel
            </button>
            <button
              type="button"
              className="tab-btn"
              style={{ fontSize: '12px', padding: '6px 14px' }}
              onClick={loadReport}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Custom Date Range Row (if selected) */}
        {timeframe === 'custom' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '14px',
              fontSize: '12px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#334155' }}>Select Custom Dates:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ color: '#64748b' }}>From:</label>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ color: '#64748b' }}>To:</label>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '5px 12px', fontSize: '12px' }}
              onClick={loadReport}
            >
              Apply Dates
            </button>
          </div>
        )}

        {/* Dimension Filters: Category, Supplier, Product */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
              Filter by Category
            </label>
            <select
              className="form-select"
              style={{ fontSize: '12px', padding: '5px 8px' }}
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">-- All Categories --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
              Filter by Specific Product
            </label>
            <select
              className="form-select"
              style={{ fontSize: '12px', padding: '5px 8px' }}
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
            >
              <option value="">-- All Products / Items --</option>
              {products.map((p) => (
                <option key={p.variantId} value={p.variantId}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
              Filter by Supplier (Sourced Items)
            </label>
            <select
              className="form-select"
              style={{ fontSize: '12px', padding: '5px 8px' }}
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="">-- All Suppliers --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
              Instant Item Search
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '12px', padding: '5px 8px' }}
              placeholder="Search in table..."
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* KPI Summary Cards - Single Line 8-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px' }}>
        {/* Total Sales Revenue */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Total Sales Revenue">
            Total Sales Revenue
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {totalRevRs}
          </div>
          <div style={{ fontSize: '9.5px', opacity: 0.75, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {report?.totalSalesCount || 0} sales transactions
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #78350f, #d97706)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Cost of Goods (COGS)">
            Cost of Goods (COGS)
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {totalCostRs}
          </div>
          <div style={{ fontSize: '9.5px', opacity: 0.75, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Cost of baked / bought
          </div>
        </div>

        {/* Gross Profit */}
        <div
          style={{
            background: isProfitable
              ? 'linear-gradient(135deg, #064e3b, #059669)'
              : 'linear-gradient(135deg, #7f1d1d, #dc2626)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Net Gross Profit">
            Net Gross Profit
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {grossProfitRs}
          </div>
          <div style={{ fontSize: '9.5px', opacity: 0.75, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isProfitable ? '✓ Net Positive Profit' : '⚠️ Net Loss Recorded'}
          </div>
        </div>

        {/* Operating Expenses */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Operating Expenses (OPEX)">
            Operating Expenses (OPEX)
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', color: '#ea580c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {totalOpexRs}
          </div>
          <div style={{ fontSize: '9.5px', color: '#9a3412', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Bills, repairs & misc
          </div>
        </div>

        {/* Staff Payroll & Advances */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Staff Payroll & Advances">
            Staff Costs & Adv.
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {totalStaffCostRs}
          </div>
          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`Net Salaries Disbursed: Rs. ${totalPayrollRs} | Staff Advances Paid: Rs. ${totalAdvancesRs}`}>
            Sal: {totalPayrollRs} | Adv: {totalAdvancesRs}
          </div>
        </div>

        {/* True Net Operating Profit */}
        <div
          style={{
            background: isNetProfitable
              ? 'linear-gradient(135deg, #064e3b, #047857)'
              : 'linear-gradient(135deg, #7f1d1d, #b91c1c)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="True Net Operating Profit">
            True Net Operating Profit
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rs. {netProfitRs}
          </div>
          <div style={{ fontSize: '9.5px', opacity: 0.85, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {report?.netProfitMarginPercent || 0}% Net Margin
          </div>
        </div>

        {/* Profit Margin % */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Profit Margin %">
            Profit Margin %
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', color: isProfitable ? '#059669' : '#dc2626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {report?.profitMarginPercent || 0}%
          </div>
          <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Gross margin on sales
          </div>
        </div>

        {/* Units Sold */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Total Units Sold">
            Total Units Sold
          </div>
          <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {report?.totalUnitsSold || 0}
          </div>
          <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Across {report?.items.length || 0} varieties
          </div>
        </div>
      </div>

      {/* Item-by-Item Profit Breakdown Table */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
              📊 Product-Wise Profit & Loss Breakdown
            </span>
            <span style={{ marginLeft: '10px', fontSize: '12px', color: '#64748b' }}>
              ({items.length} item records)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>Sort by:</span>
            <button
              type="button"
              className={`btn-secondary ${sortField === 'profit' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: sortField === 'profit' ? 700 : 400 }}
              onClick={() => {
                if (sortField === 'profit') setSortAsc(!sortAsc);
                else {
                  setSortField('profit');
                  setSortAsc(false);
                }
              }}
            >
              Profit {sortField === 'profit' ? (sortAsc ? '▲' : '▼') : ''}
            </button>
            <button
              type="button"
              className={`btn-secondary ${sortField === 'revenue' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: sortField === 'revenue' ? 700 : 400 }}
              onClick={() => {
                if (sortField === 'revenue') setSortAsc(!sortAsc);
                else {
                  setSortField('revenue');
                  setSortAsc(false);
                }
              }}
            >
              Revenue {sortField === 'revenue' ? (sortAsc ? '▲' : '▼') : ''}
            </button>
            <button
              type="button"
              className={`btn-secondary ${sortField === 'margin' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: sortField === 'margin' ? 700 : 400 }}
              onClick={() => {
                if (sortField === 'margin') setSortAsc(!sortAsc);
                else {
                  setSortField('margin');
                  setSortAsc(false);
                }
              }}
            >
              Margin % {sortField === 'margin' ? (sortAsc ? '▲' : '▼') : ''}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Product Name</th>
                <th style={{ textAlign: 'left', padding: '10px 8px' }}>SKU</th>
                <th style={{ textAlign: 'left', padding: '10px 8px' }}>Category</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Qty Sold</th>
                <th style={{ textAlign: 'right', padding: '10px 10px' }}>Avg Sell (Rs)</th>
                <th style={{ textAlign: 'right', padding: '10px 10px' }}>Unit Buy (Rs)</th>
                <th style={{ textAlign: 'right', padding: '10px 10px' }}>Revenue (Rs)</th>
                <th style={{ textAlign: 'right', padding: '10px 10px' }}>Cost (Rs)</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Gross Profit</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    {loading ? 'Calculating Profit & Loss statement...' : 'No sales or items recorded for this timeframe/filter.'}
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const sellPrice = (it.avgSellPriceMinorUnits / 100).toFixed(2);
                  const buyCost = (it.avgCostPriceMinorUnits / 100).toFixed(2);
                  const revenue = (it.totalRevenueMinorUnits / 100).toFixed(2);
                  const cost = (it.totalCostMinorUnits / 100).toFixed(2);
                  const profit = (it.grossProfitMinorUnits / 100).toFixed(2);
                  const hasProfit = it.grossProfitMinorUnits >= 0;

                  return (
                    <tr key={it.variantId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                        {it.productName}
                      </td>
                      <td style={{ padding: '8px 8px', fontFamily: 'monospace', color: '#64748b' }}>
                        {it.sku}
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        {it.categoryName ? (
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {it.categoryName}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 700 }}>
                        {it.unitsSold}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                        Rs. {sellPrice}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: '#475569' }}>
                        Rs. {buyCost}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#1d4ed8' }}>
                        Rs. {revenue}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: '#b45309' }}>
                        Rs. {cost}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          fontWeight: 700,
                          color: hasProfit ? '#059669' : '#dc2626',
                        }}
                      >
                        {hasProfit ? '+' : ''}Rs. {profit}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: hasProfit ? '#dcfce7' : '#fee2e2',
                            color: hasProfit ? '#166534' : '#991b1b',
                          }}
                        >
                          {it.marginPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                <tr>
                  <td colSpan={3} style={{ padding: '10px 12px' }}>
                    Totals ({items.length} Products)
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    {report?.totalUnitsSold}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 10px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '10px 10px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '10px 10px', color: '#1d4ed8' }}>
                    Rs. {totalRevRs}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 10px', color: '#b45309' }}>
                    Rs. {totalCostRs}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: isProfitable ? '#059669' : '#dc2626' }}>
                    Rs. {grossProfitRs}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: isProfitable ? '#dcfce7' : '#fee2e2',
                        color: isProfitable ? '#166534' : '#991b1b',
                      }}
                    >
                      {report?.profitMarginPercent}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
