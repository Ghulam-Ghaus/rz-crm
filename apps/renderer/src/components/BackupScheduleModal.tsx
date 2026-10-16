import React, { useState, useEffect } from 'react';
import type { BackupScheduleConfig } from '@rz-crm/contracts';

interface BackupScheduleModalProps {
  currentConfig: BackupScheduleConfig | null;
  onSave: (config: BackupScheduleConfig) => Promise<void>;
  onClose: () => void;
}

export const BackupScheduleModal: React.FC<BackupScheduleModalProps> = ({
  currentConfig,
  onSave,
  onClose,
}) => {
  const [enabled, setEnabled] = useState<boolean>(currentConfig?.enabled ?? true);
  const [frequencyHours, setFrequencyHours] = useState<number>(currentConfig?.frequencyHours ?? 24);
  const [autoBackupOnShiftClose, setAutoBackupOnShiftClose] = useState<boolean>(
    currentConfig?.autoBackupOnShiftClose ?? true
  );
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(
    currentConfig?.includeAttachments ?? true
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.enabled);
      setFrequencyHours(currentConfig.frequencyHours);
      setAutoBackupOnShiftClose(currentConfig.autoBackupOnShiftClose);
      setIncludeAttachments(currentConfig.includeAttachments);
    }
  }, [currentConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        enabled,
        frequencyHours,
        autoBackupOnShiftClose,
        includeAttachments,
        lastAutoBackupUtc: currentConfig?.lastAutoBackupUtc ?? null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setSaving(false);
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
          maxWidth: '520px',
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
            <span style={{ fontSize: '20px' }}>⏱️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Automated Backup Schedule
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Configure background timers &amp; cashier shift safety triggers
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
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

          {/* Master Enable Toggle */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: enabled ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: enabled ? '#166534' : '#475569' }}>
                Automated Scheduled Backups
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {enabled ? 'Active — system takes consistent online snapshots' : 'Disabled — backups must be triggered manually'}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* Backup Frequency Selection */}
          <div style={{ marginBottom: '16px', opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Snapshot Frequency Interval
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { label: 'Every 6h', value: 6 },
                { label: 'Every 12h', value: 12 },
                { label: 'Daily (24h)', value: 24 },
                { label: 'Every 48h', value: 48 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFrequencyHours(item.value)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: frequencyHours === item.value ? '2px solid #0067b8' : '1px solid #cbd5e1',
                    backgroundColor: frequencyHours === item.value ? '#eff6ff' : '#ffffff',
                    color: frequencyHours === item.value ? '#0067b8' : '#475569',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Close Trigger */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                Auto-Backup on Cashier Shift Close
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Trigger safety database snapshot whenever a POS cashier closes register
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoBackupOnShiftClose}
                onChange={(e) => setAutoBackupOnShiftClose(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* WebP Attachments Option */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                Include WebP Attachments in DR Bundles
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Bundle optimized receipts and cheque photos into disaster recovery archives
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

          {/* Schedule Info / Last Run */}
          {currentConfig?.lastAutoBackupUtc && (
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>
              Last automated run: {new Date(currentConfig.lastAutoBackupUtc).toLocaleString()}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '7px 16px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ padding: '7px 18px', fontSize: '12px' }}
            >
              {saving ? 'Saving...' : 'Save Schedule Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
