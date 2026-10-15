import React, { useState, useEffect, useMemo, useRef } from 'react';

export interface PosWeightTarget {
  variantId: number;
  name: string;
  sku: string;
  priceMinorUnits: number;
  baseUnitCode?: string;
  currentQuantity?: number;
}

interface PosWeightAmountModalProps {
  target: PosWeightTarget | null;
  onClose: () => void;
  onConfirm: (target: PosWeightTarget, quantity: number) => void;
}

export const PosWeightAmountModal: React.FC<PosWeightAmountModalProps> = ({
  target,
  onClose,
  onConfirm,
}) => {
  if (!target) return null;

  const unitCode = (target.baseUnitCode || 'kg').toLowerCase();
  const isWeighed = unitCode === 'kg' || unitCode === 'kilogram' || unitCode === 'g' || unitCode === 'gram';
  const pricePerKg = target.priceMinorUnits / 100;

  // Tabs: 'amount' (Sell by Rs), 'weight' (Sell by Grams/Kg), 'count' (Sell by Pieces)
  const [activeMode, setActiveMode] = useState<'amount' | 'weight' | 'count'>(isWeighed ? 'amount' : 'count');
  const [rupeesInput, setRupeesInput] = useState<string>('50');
  const [weightKgInput, setWeightKgInput] = useState<string>(
    target.currentQuantity && target.currentQuantity > 0 ? String(target.currentQuantity) : '0.25'
  );
  const [countInput, setCountInput] = useState<string>(
    target.currentQuantity && target.currentQuantity > 0 ? String(Math.round(target.currentQuantity)) : '1'
  );

  const rupeesInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const countInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus active input
  useEffect(() => {
    if (activeMode === 'amount') {
      setTimeout(() => rupeesInputRef.current?.select(), 50);
    } else if (activeMode === 'weight') {
      setTimeout(() => weightInputRef.current?.select(), 50);
    } else {
      setTimeout(() => countInputRef.current?.select(), 50);
    }
  }, [activeMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculations
  const calculatedFromAmount = useMemo(() => {
    const amt = parseFloat(rupeesInput) || 0;
    if (amt <= 0 || pricePerKg <= 0) return { qtyKg: 0, grams: 0, totalRs: 0 };
    const rawQtyKg = amt / pricePerKg;
    const roundedQtyKg = Number(rawQtyKg.toFixed(4));
    const grams = Math.round(rawQtyKg * 1000);
    return {
      qtyKg: roundedQtyKg,
      grams,
      totalRs: amt,
    };
  }, [rupeesInput, pricePerKg]);

  const calculatedFromWeight = useMemo(() => {
    const kg = parseFloat(weightKgInput) || 0;
    if (kg <= 0 || pricePerKg <= 0) return { qtyKg: 0, grams: 0, totalRs: 0 };
    const grams = Math.round(kg * 1000);
    const totalRs = Math.round((kg * target.priceMinorUnits) / 100);
    return {
      qtyKg: kg,
      grams,
      totalRs,
    };
  }, [weightKgInput, pricePerKg, target.priceMinorUnits]);

  const calculatedFromCount = useMemo(() => {
    const count = parseInt(countInput, 10) || 0;
    const totalRs = (count * target.priceMinorUnits) / 100;
    return {
      count,
      totalRs,
    };
  }, [countInput, target.priceMinorUnits]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeMode === 'amount') {
      if (calculatedFromAmount.qtyKg > 0) {
        onConfirm(target, calculatedFromAmount.qtyKg);
      }
    } else if (activeMode === 'weight') {
      if (calculatedFromWeight.qtyKg > 0) {
        onConfirm(target, calculatedFromWeight.qtyKg);
      }
    } else {
      if (calculatedFromCount.count > 0) {
        onConfirm(target, calculatedFromCount.count);
      }
    }
  };

  const RUPEE_PRESETS = [50, 100, 150, 200, 250, 500, 1000];
  const WEIGHT_PRESETS = [
    { label: '100g', kg: 0.1 },
    { label: '250g (پاؤ)', kg: 0.25 },
    { label: '500g (ادھا کلو)', kg: 0.5 },
    { label: '750g (تین پاؤ)', kg: 0.75 },
    { label: '1 kg', kg: 1.0 },
    { label: '1.5 kg', kg: 1.5 },
    { label: '2 kg', kg: 2.0 },
  ];
  const COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 10, 12, 20, 50];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isWeighed ? '⚖️ Weighed Item Configuration' : '🔢 Unit Item Quantity'}
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '2px 0 0 0', color: '#ffffff' }}>
              {target.name}
            </h3>
            <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
              Rate: Rs. {pricePerKg.toFixed(2)} per {target.baseUnitCode || 'kg'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs */}
        {isWeighed ? (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setActiveMode('amount')}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                borderBottom: activeMode === 'amount' ? '3px solid #0067b8' : '3px solid transparent',
                background: activeMode === 'amount' ? '#ffffff' : 'transparent',
                fontWeight: activeMode === 'amount' ? 700 : 500,
                color: activeMode === 'amount' ? '#0067b8' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              💵 Sell by Rupees (روپے درج کریں)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('weight')}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                borderBottom: activeMode === 'weight' ? '3px solid #0067b8' : '3px solid transparent',
                background: activeMode === 'weight' ? '#ffffff' : 'transparent',
                fontWeight: activeMode === 'weight' ? 700 : 500,
                color: activeMode === 'weight' ? '#0067b8' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              ⚖️ Sell by Weight (وزن درج کریں)
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {/* TAB 1: SELL BY RUPEES */}
          {activeMode === 'amount' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Enter Rupee Amount (رقم):
              </label>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: '#64748b',
                    fontSize: '15px',
                  }}
                >
                  Rs.
                </span>
                <input
                  ref={rupeesInputRef}
                  type="number"
                  step="any"
                  min="1"
                  value={rupeesInput}
                  onChange={(e) => setRupeesInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 42px',
                    fontSize: '18px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '2px solid #0067b8',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#0f172a',
                  }}
                  placeholder="e.g. 50, 100, 150"
                />
              </div>

              {/* Quick Rupee Presets */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
                  Quick Amount Presets:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {RUPEE_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRupeesInput(String(amt))}
                      style={{
                        padding: '6px 12px',
                        background: rupeesInput === String(amt) ? '#0067b8' : '#f1f5f9',
                        color: rupeesInput === String(amt) ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      Rs. {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Calculation Breakdown Box */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#166534' }}>
                  <span>Customer Pays:</span>
                  <strong style={{ fontSize: '14px' }}>Rs. {calculatedFromAmount.totalRs.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#166534' }}>
                  <span>Calculated Scale Weight:</span>
                  <strong style={{ fontSize: '14px', color: '#15803d' }}>
                    {calculatedFromAmount.grams} grams ({calculatedFromAmount.qtyKg.toFixed(3)} kg)
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SELL BY WEIGHT */}
          {activeMode === 'weight' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Select or Enter Weight in KG (وزن):
              </label>

              {/* Quick Weight Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
                {WEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setWeightKgInput(String(preset.kg))}
                    style={{
                      padding: '8px 10px',
                      background: parseFloat(weightKgInput) === preset.kg ? '#0067b8' : '#f8fafc',
                      color: parseFloat(weightKgInput) === preset.kg ? '#ffffff' : '#1e293b',
                      border: parseFloat(weightKgInput) === preset.kg ? '1px solid #005a9e' : '1px solid #cbd5e1',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <span
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  kg
                </span>
                <input
                  ref={weightInputRef}
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={weightKgInput}
                  onChange={(e) => setWeightKgInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 40px 8px 12px',
                    fontSize: '16px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '2px solid #0067b8',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#0f172a',
                  }}
                  placeholder="e.g. 0.25, 0.5, 0.385"
                />
              </div>

              {/* Real-time Calculation Breakdown Box */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#166534' }}>
                  <span>Weight on Scale:</span>
                  <strong style={{ fontSize: '14px' }}>
                    {calculatedFromWeight.grams} grams ({calculatedFromWeight.qtyKg} kg)
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#166534' }}>
                  <span>Line Total to Charge:</span>
                  <strong style={{ fontSize: '15px', color: '#15803d' }}>
                    Rs. {calculatedFromWeight.totalRs.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SELL BY COUNT (PIECES) */}
          {activeMode === 'count' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Quantity (تعداد / Pieces):
              </label>

              {/* Quick Count Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {COUNT_PRESETS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setCountInput(String(cnt))}
                    style={{
                      padding: '8px 12px',
                      background: parseInt(countInput, 10) === cnt ? '#0067b8' : '#f8fafc',
                      color: parseInt(countInput, 10) === cnt ? '#ffffff' : '#1e293b',
                      border: parseInt(countInput, 10) === cnt ? '1px solid #005a9e' : '1px solid #cbd5e1',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {cnt === 12 ? '12 (درجن)' : cnt}
                  </button>
                ))}
              </div>

              <input
                ref={countInputRef}
                type="number"
                step="1"
                min="1"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '2px solid #0067b8',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  marginBottom: '14px',
                }}
                placeholder="Enter pieces count..."
              />

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#166534' }}>
                  <span>Total Amount for {calculatedFromCount.count} pcs:</span>
                  <strong style={{ fontSize: '15px', color: '#15803d' }}>
                    Rs. {calculatedFromCount.totalRs.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '5px',
                backgroundColor: '#0067b8',
              }}
            >
              {activeMode === 'amount'
                ? `Confirm Rs. ${calculatedFromAmount.totalRs} (${calculatedFromAmount.grams}g)`
                : activeMode === 'weight'
                ? `Confirm ${calculatedFromWeight.grams}g (Rs. ${calculatedFromWeight.totalRs})`
                : `Confirm ${calculatedFromCount.count} pcs (Rs. ${calculatedFromCount.totalRs})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
