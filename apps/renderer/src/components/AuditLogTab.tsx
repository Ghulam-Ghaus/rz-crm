import React, { useState, useEffect, useCallback } from 'react';
import type {
  AuditLog,
  AuditSummaryStats,
  AuditActionCategory,
} from '@rz-crm/contracts';

interface AuditLogTabProps {
  currentUsername?: string;
  currentUserRole?: string;
}

function formatUtc(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export const AuditLogTab: React.FC<AuditLogTabProps> = ({
  currentUsername: _currentUsername,
  currentUserRole: _currentUserRole,
}) => {
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<AuditSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<AuditActionCategory>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Details Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  // Load summary metrics
  const loadSummary = useCallback(async () => {
    if (!window.bakery?.audit?.getSummary) return;
    try {
      const res = await window.bakery.audit.getSummary();
      if (res.success) {
        setSummary(res.data);
      }
    } catch {
      // Ignored
    }
  }, []);

  // Load audit logs list
  const loadLogs = useCallback(async () => {
    if (!window.bakery?.audit?.list) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const query: any = {
        limit: 150,
        offset: 0,
      };

      if (search.trim()) query.search = search.trim();
      if (selectedCategory !== 'ALL') query.category = selectedCategory;
      if (selectedSeverity !== 'ALL') query.severity = selectedSeverity;
      if (startDate) query.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.endDate = e.toISOString();
      }

      const res = await window.bakery.audit.list(query);
      if (res.success) {
        setLogs(res.data.logs);
        setTotalCount(res.data.totalCount);
      } else {
        setErrorMsg(res.error?.message || 'Failed to fetch audit entries');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading audit logs');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedSeverity, startDate, endDate]);

  useEffect(() => {
    loadSummary();
    loadLogs();
  }, [loadSummary, loadLogs]);

  // Export to CSV
  const handleExport = async () => {
    if (!window.bakery?.audit?.export) return;
    try {
      const query: any = {};
      if (search.trim()) query.search = search.trim();
      if (selectedCategory !== 'ALL') query.category = selectedCategory;
      if (selectedSeverity !== 'ALL') query.severity = selectedSeverity;
      if (startDate) query.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.endDate = e.toISOString();
      }

      const res = await window.bakery.audit.export(query);
      if (res.success && res.data.filePath) {
        setSuccessMsg(`Audit logs successfully exported to ${res.data.filePath}`);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to export audit logs');
    }
  };

  // Helper to parse details JSON
  const formatDetailsPreview = (jsonStr: string | null | undefined): string => {
    if (!jsonStr) return '-';
    try {
      const parsed = JSON.parse(jsonStr);
      // Omit internal _severity
      const { _severity, ...rest } = parsed;
      const keys = Object.keys(rest);
      if (keys.length === 0) return '-';
      return keys.map(k => `${k}: ${String(rest[k])}`).slice(0, 3).join(' · ');
    } catch {
      return jsonStr.slice(0, 80);
    }
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Top Header & Refresh / Export Actions */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
              Security Activity & Audit Monitor
            </h2>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
              Immutable operational audit trail & security compliance evidence
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className="tab-btn"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#f3f4f6' }}
            onClick={() => {
              loadSummary();
              loadLogs();
            }}
            disabled={loading}
          >
            {loading ? '⏳ Refreshing...' : '🔄 Refresh Logs'}
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#f3f4f6' }}
            onClick={() => window.print()}
          >
            🖨️ Print Audit
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ fontSize: '11px', padding: '5px 12px', background: '#0284c7', color: '#ffffff', fontWeight: 600 }}
            onClick={handleExport}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        >
          ✅ {successMsg}
        </div>
      )}

      {/* Error Notification */}
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

      {/* Compact KPI Summary Bar (Low vertical padding per design rules) */}
      {summary && (
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
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Audits</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              {summary.totalAuditCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>Append-only records</div>
          </div>

          <div
            style={{
              background: summary.failedLoginsCount > 0 ? '#fef2f2' : '#ffffff',
              border: `1px solid ${summary.failedLoginsCount > 0 ? '#fca5a5' : '#e5e7eb'}`,
              borderRadius: '6px',
              padding: '6px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: summary.failedLoginsCount > 0 ? '#991b1b' : '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>
              Auth & Logins
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: summary.failedLoginsCount > 0 ? '#dc2626' : '#111827' }}>
              {summary.authEventsCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: summary.failedLoginsCount > 0 ? '#dc2626' : '#9ca3af', fontWeight: summary.failedLoginsCount > 0 ? 700 : 400 }}>
              {summary.failedLoginsCount > 0 ? `⚠️ ${summary.failedLoginsCount} failed attempts` : 'Zero failed logins'}
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
            <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Stock Adjustments</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309' }}>
              {summary.stockAdjustmentsCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>Manual inventory edits</div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '6px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#0369a1', textTransform: 'uppercase', fontWeight: 600 }}>Price Overrides</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0284c7' }}>
              {summary.priceOverridesCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>Discounts & price edits</div>
          </div>

          <div
            style={{
              background: summary.criticalEventsCount > 0 ? '#fff7ed' : '#ffffff',
              border: `1px solid ${summary.criticalEventsCount > 0 ? '#fed7aa' : '#e5e7eb'}`,
              borderRadius: '6px',
              padding: '6px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: summary.criticalEventsCount > 0 ? '#9a3412' : '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
              Critical Operations
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: summary.criticalEventsCount > 0 ? '#ea580c' : '#111827' }}>
              {summary.criticalEventsCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>
              {summary.lastActivityUtc ? `Last: ${formatUtc(summary.lastActivityUtc)}` : 'No recent activity'}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '6px 10px',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search user, action, resource, details..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              width: '260px',
            }}
          />

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as any)}
            style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '5px' }}
          >
            <option value="ALL">All Categories</option>
            <option value="AUTH">🔐 Authentication & Access</option>
            <option value="SALES_AND_PRICING">💰 Sales & Pricing Overrides</option>
            <option value="INVENTORY_AND_STOCK">📦 Inventory & Stock Adjustments</option>
            <option value="PURCHASING_AND_RETURNS">🚚 Purchasing & Reversals</option>
            <option value="FINANCE_AND_PAYROLL">💳 Expenses & Payroll</option>
            <option value="STAKEHOLDERS_AND_EQUITY">🤝 Stakeholders & Equity</option>
            <option value="SYSTEM_AND_BACKUP">💾 System & Backups</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '5px' }}
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">🟢 INFO</option>
            <option value="WARN">🟡 WARN</option>
            <option value="CRITICAL">🔴 CRITICAL</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280' }}>
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
          Showing {logs.length} of {totalCount} records
        </div>
      </div>

      {/* Audit Log Table */}
      <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '60px' }}>ID</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '170px' }}>Timestamp</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '110px' }}>User</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '160px' }}>Action</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '100px' }}>Resource</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, width: '90px' }}>Severity</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Details Preview</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center', width: '80px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, idx) => {
              let sevBg = '#ecfdf5';
              let sevColor = '#047857';
              if (l.severity === 'WARN') {
                sevBg = '#fef3c7';
                sevColor = '#b45309';
              } else if (l.severity === 'CRITICAL') {
                sevBg = '#fee2e2';
                sevColor = '#b91c1c';
              }

              return (
                <tr
                  key={l.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                  }}
                >
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#6b7280', fontSize: '11px' }}>
                    #{l.id}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#374151', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {formatUtc(l.createdAtUtc)}
                  </td>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: '#111827' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      👤 {l.username || 'system'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#334155',
                        fontFamily: 'monospace',
                      }}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', color: '#6b7280', fontSize: '11px' }}>
                    {l.resource || '-'}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: sevBg,
                        color: sevColor,
                      }}
                    >
                      {l.severity}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', color: '#4b5563', fontSize: '11px' }}>
                    {formatDetailsPreview(l.detailsJson)}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <button
                      type="button"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      onClick={() => setInspectLog(l)}
                    >
                      👁️ Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                  {loading ? 'Querying security audit records...' : 'No audit entries match filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Inspector Modal */}
      {inspectLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              width: '560px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🔍</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                  Audit Entry #{inspectLog.id} · {inspectLog.action}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Timestamp (UTC):</span>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{inspectLog.createdAtUtc}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>User:</span>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{inspectLog.username || 'system'} (ID: {inspectLog.userId || 'N/A'})</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Resource:</span>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{inspectLog.resource || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Severity:</span>
                  <div>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: inspectLog.severity === 'CRITICAL' ? '#fee2e2' : inspectLog.severity === 'WARN' ? '#fef3c7' : '#ecfdf5',
                        color: inspectLog.severity === 'CRITICAL' ? '#b91c1c' : inspectLog.severity === 'WARN' ? '#b45309' : '#047857',
                      }}
                    >
                      {inspectLog.severity}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Structured Evidence Details:</div>
              <pre
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  overflowX: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {inspectLog.detailsJson
                  ? JSON.stringify(JSON.parse(inspectLog.detailsJson), null, 2)
                  : 'No extra details recorded.'}
              </pre>
            </div>

            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="tab-btn"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={() => setInspectLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
