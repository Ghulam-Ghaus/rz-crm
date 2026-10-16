import React, { useState } from 'react';
import type { ExportArchiveBundleResult } from '@rz-crm/contracts';

interface ExportArchiveBundleModalProps {
  filename: string;
  onExport: (filename: string, includeAttachments: boolean) => Promise<ExportArchiveBundleResult>;
  onOpenFolder: () => void;
  onClose: () => void;
}

export const ExportArchiveBundleModal: React.FC<ExportArchiveBundleModalProps> = ({
  filename,
  onExport,
  onOpenFolder,
  onClose,
}) => {
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [result, setResult] = useState<ExportArchiveBundleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await onExport(filename, includeAttachments);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export disaster recovery bundle');
    } finally {
      setExporting(false);
    }
  };

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
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
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
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📦</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Export Disaster Recovery Bundle
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Complete offline archive package with database, manifest, and photo attachments
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
        <div style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecdd3',
                color: '#991b1b',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {!result ? (
            <div>
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
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Source Database Snapshot:</span>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{filename}</span>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                    Include WebP Photo Attachments
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Bundles all physical bank slips, cheque images, and customer receipts
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeAttachments}
                    onChange={(e) => setIncludeAttachments(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                This creates a standalone disaster recovery folder containing the SQLite database snapshot, JSON integrity manifest, attachments, and a comprehensive <code>README-DISASTER-RECOVERY.txt</code> restoration manual for secondary machines.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #10b981',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '24px' }}>✅</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                    DISASTER RECOVERY BUNDLE EXPORTED
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                    {result.message}
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Database Snapshot:</span>{' '}
                    <span style={{ color: '#059669', fontWeight: 700 }}>✓ Included</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Manifest JSON:</span>{' '}
                    <span style={{ color: '#059669', fontWeight: 700 }}>✓ Included</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Photo Attachments:</span>{' '}
                    <span style={{ fontWeight: 700 }}>{result.attachmentsCount} files</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Total Bundle Size:</span>{' '}
                    <span style={{ fontWeight: 700 }}>{(result.totalSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Destination Path:</span>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0f172a', wordBreak: 'break-all', marginTop: '2px' }}>
                    {result.destinationPath}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          {!result ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={exporting}
                style={{ padding: '7px 16px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartExport}
                disabled={exporting}
                style={{ padding: '7px 18px', fontSize: '12px' }}
              >
                {exporting ? 'Packaging Archive...' : '📦 Export DR Bundle'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={onOpenFolder}
                style={{ padding: '7px 16px', fontSize: '12px' }}
              >
                📁 Open in Explorer
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
                style={{ padding: '7px 18px', fontSize: '12px' }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
