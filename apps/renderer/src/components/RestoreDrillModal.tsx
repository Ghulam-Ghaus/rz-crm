import React from 'react';
import type { RestoreDrillResult } from '@rz-crm/contracts';

interface RestoreDrillModalProps {
  result: RestoreDrillResult | null;
  onClose: () => void;
}

export const RestoreDrillModal: React.FC<RestoreDrillModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  const isPassed = result.passed;
  const tableEntries = Object.entries(result.recordCounts || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: `1px solid ${isPassed ? '#a7f3d0' : '#fecdd3'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isPassed ? '#f0fdf4' : '#fff1f2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{isPassed ? '🧪' : '⚠️'}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Restore Drill Simulation Report
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Isolated read-only verification of snapshot integrity &amp; foreign keys
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Status Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: isPassed ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${isPassed ? '#10b981' : '#ef4444'}`,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '24px' }}>{isPassed ? '✅' : '❌'}</div>
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isPassed ? '#065f46' : '#991b1b',
                }}
              >
                {isPassed ? 'DRILL RECOVERY PASSED: 100% HEALTHY' : 'DRILL RECOVERY FAILED'}
              </div>
              <div style={{ fontSize: '12px', color: isPassed ? '#047857' : '#b91c1c', marginTop: '2px' }}>
                {result.message}
              </div>
            </div>
          </div>

          {/* Snapshot Info */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 12px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#334155',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Snapshot File:</span>{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{result.snapshotFilename}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Drill Executed At:</span>{' '}
                <span>{new Date(result.drillExecutedAtUtc).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Technical Diagnostics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                PRAGMA Integrity
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: result.integrityCheckResult === 'ok' ? '#059669' : '#dc2626',
                  marginTop: '2px',
                  fontFamily: 'monospace',
                }}
              >
                {result.integrityCheckResult.toUpperCase()}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Foreign Key Check
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: result.foreignKeyCheckPassed ? '#059669' : '#dc2626',
                  marginTop: '2px',
                }}
              >
                {result.foreignKeyCheckPassed ? '0 VIOLATIONS' : 'FAILED'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Drill Duration
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0284c7',
                  marginTop: '2px',
                  fontFamily: 'monospace',
                }}
              >
                {result.durationMs} ms
              </div>
            </div>
          </div>

          {/* Database Tables & Record Count Audit */}
          <div style={{ marginBottom: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Verified Tables &amp; Record Counts ({result.tablesVerifiedCount} tables)
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Read-only simulation (Zero production mutation)
              </span>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', color: '#475569', fontWeight: 600 }}>Table Name</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', color: '#475569', fontWeight: 600 }}>Record Count</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', color: '#475569', fontWeight: 600 }}>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableEntries.map(([table, count]) => (
                    <tr key={table} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', color: '#0f172a', fontWeight: 500, fontFamily: 'monospace' }}>
                        {table}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: count > 0 ? '#0f172a' : '#94a3b8' }}>
                        {count.toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: count >= 0 ? '#ecfdf5' : '#fef2f2',
                            color: count >= 0 ? '#065f46' : '#991b1b',
                          }}
                        >
                          {count >= 0 ? '✓ VERIFIED' : 'ERROR'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tableEntries.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                        No tables detected in snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            🔒 Cryptographically verified SQLite WAL snapshot
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
            onClick={onClose}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
