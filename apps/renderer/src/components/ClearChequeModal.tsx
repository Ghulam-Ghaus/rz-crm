import React, { useState, useEffect, useRef } from 'react';
import { ChequeItem, CompanyBankAccount } from '@rz-crm/contracts';
import { compressImageToWebP, formatBytes, CompressionResult } from '../utils/image-compression';
import { useToast } from '../context/ToastContext';

interface ClearChequeModalProps {
  cheque: ChequeItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClearChequeModal: React.FC<ClearChequeModalProps> = ({
  cheque,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [clearingDate, setClearingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [compressing, setCompressing] = useState<boolean>(false);

  // Photo attachment states
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);

  useEffect(() => {
    if (!cheque) return;

    let isMounted = true;
    setLoadingAccounts(true);

    window.bakery.bank
      .listAccounts(1)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          const active = res.data.filter((a: CompanyBankAccount) => a.isActive);
          setAccounts(active);
          if (active.length > 0) {
            setSelectedAccountId(active[0].id);
          }
        }
      })
      .catch((err: any) => {
        toast.error(err.message, 'Failed to load bank accounts');
      })
      .finally(() => {
        if (isMounted) setLoadingAccounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cheque, toast]);

  if (!cheque) return null;

  const isInward = cheque.direction === 'INWARD_CUSTOMER';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressing(true);
      const result = await compressImageToWebP(file, 1280, 0.82);
      setCompressionResult(result);
    } catch (err: any) {
      toast.error(err.message || 'Unable to compress photo', 'Image Compression Failed');
    } finally {
      setCompressing(false);
    }
  };

  const handleRemovePhoto = () => {
    setCompressionResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      toast.warning('Please select which company bank account this cheque clears into/from.', 'Missing Bank Account');
      return;
    }

    try {
      setSubmitting(true);

      let savedAttachmentPath: string | undefined = undefined;

      // 1. Upload compressed WebP photo if selected
      if (compressionResult) {
        const attachRes = await window.bakery.attachments.save({
          folder: 'cheques',
          filenamePrefix: `chk_${cheque.direction.toLowerCase()}_${cheque.id}`,
          base64Data: compressionResult.base64Data,
        });

        if (!attachRes.success) {
          throw new Error(attachRes.error?.message || 'Failed to save cheque photo');
        }
        savedAttachmentPath = attachRes.data?.relativePath;
      }

      // 2. Clear cheque in bank ledger
      const clearRes = await window.bakery.bank.clearCheque({
        storeId: 1,
        bankAccountId: Number(selectedAccountId),
        chequeDirection: cheque.direction,
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber || undefined,
        amountMinorUnits: cheque.amountMinorUnits,
        clearingDateUtc: clearingDate ? `${clearingDate}T12:00:00Z` : new Date().toISOString(),
        notes: notes.trim() || undefined,
        attachmentPath: savedAttachmentPath,
      });

      if (!clearRes.success) {
        throw new Error(clearRes.error?.message || 'Failed to clear cheque');
      }

      toast.success(
        `${isInward ? 'Inward customer' : 'Outward supplier'} cheque #${cheque.chequeNumber || cheque.id} has been marked CLEARED in bank account.`,
        'Cheque Cleared Successfully',
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred while clearing cheque.', 'Cheque Clearing Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: isInward ? '#f0fdf4' : '#fff7ed',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{isInward ? '📥' : '📤'}</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Clear {isInward ? 'Customer Inward Cheque' : 'Supplier Outward Cheque'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '18px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cheque Summary Card */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Party / Entity:</span>
              <strong style={{ color: '#0f172a' }}>{cheque.partyName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Amount:</span>
              <strong style={{ color: isInward ? '#16a34a' : '#ea580c', fontSize: '14px' }}>
                Rs. {(cheque.amountMinorUnits / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Cheque Number:</span>
              <strong style={{ color: '#0f172a' }}>{cheque.chequeNumber || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block' }}>Cheque Date:</span>
              <strong style={{ color: '#0f172a' }}>{cheque.chequeDate}</strong>
            </div>
          </div>

          {/* Company Bank Account Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Select Company Bank Account <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {loadingAccounts ? (
              <div style={{ fontSize: '12px', color: '#64748b' }}>Loading bank accounts...</div>
            ) : accounts.length === 0 ? (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '12px',
                }}
              >
                ⚠️ No active company bank accounts found. Please add a bank account in Bank Accounts tab first.
              </div>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                }}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.accountTitle} ({acc.accountNumber}) · Bal: Rs. {(acc.currentBalanceMinorUnits / 100).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              {isInward
                ? 'Funds will be credited into this company bank account.'
                : 'Funds will be debited from this company bank account.'}
            </span>
          </div>

          {/* Clearing Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Clearing Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              value={clearingDate}
              onChange={(e) => setClearingDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Photo Attachment (WebP Compressed) */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Physical Cheque / Deposit Slip Photo (Optimized WebP)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {!compressionResult ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#f8fafc',
                  transition: 'background-color 0.2s',
                }}
              >
                {compressing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                    <span style={{ fontSize: '20px' }}>⏳</span>
                    <span style={{ fontSize: '12px' }}>Auto-compressing image to WebP...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '22px' }}>📷</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      Click to upload physical cheque / clearing slip photo
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Auto-resized and compressed to WebP (~80-120 KB) · zero database bloat
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
                  padding: '10px 14px',
                  backgroundColor: '#ecfdf5',
                  borderRadius: '8px',
                  border: '1px solid #a7f3d0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={compressionResult.base64Data}
                    alt="Cheque Preview"
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #10b981' }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#065f46' }}>
                      Photo Compressed Successfully
                    </div>
                    <div style={{ fontSize: '11px', color: '#047857' }}>
                      {formatBytes(compressionResult.originalSize)} ➔{' '}
                      <strong>{formatBytes(compressionResult.compressedSize)}</strong>{' '}
                      ({compressionResult.compressionRatio}% smaller)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    background: '#ffffff',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  title="Remove Photo"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Notes / Clearing Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared via deposit slip #7890"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || accounts.length === 0}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                background: isInward ? '#16a34a' : '#ea580c',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {submitting ? 'Clearing...' : '⚡ Confirm & Clear Cheque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
