import React, { useState } from 'react';
import { useNotifications, AppNotification } from '../context/NotificationContext.js';

interface NotificationBannerProps {
  onNavigateTab: (tab: string, subTab?: string) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onNavigateTab }) => {
  const { criticalAlerts, dismissNotification } = useNotifications();
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  if (criticalAlerts.length === 0) return null;

  // Protect index bounds if alerts count changes
  const activeAlert: AppNotification = criticalAlerts[currentIndex] || criticalAlerts[0];
  if (!activeAlert) return null;

  const isCritical = activeAlert.severity === 'CRITICAL';
  const bgColor = isCritical ? '#fef2f2' : '#fffbeb';
  const borderColor = isCritical ? '#fca5a5' : '#fde68a';
  const textColor = isCritical ? '#991b1b' : '#92400e';
  const btnBg = isCritical ? '#dc2626' : '#d97706';

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % criticalAlerts.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + criticalAlerts.length) % criticalAlerts.length);
  };

  const handleAction = () => {
    if (activeAlert.targetTab) {
      onNavigateTab(activeAlert.targetTab, activeAlert.targetSubTab);
    }
  };

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '5px 12px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '12px',
        color: textColor,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{isCritical ? '🚨' : '⚠️'}</span>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>{activeAlert.title}:</span>
          <span style={{ color: textColor, opacity: 0.9 }}>{activeAlert.message}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {criticalAlerts.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: textColor }}>
            <button
              type="button"
              onClick={handlePrev}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 3px', color: textColor, fontWeight: 700 }}
              title="Previous Alert"
            >
              ◀
            </button>
            <span>{currentIndex + 1}/{criticalAlerts.length}</span>
            <button
              type="button"
              onClick={handleNext}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 3px', color: textColor, fontWeight: 700 }}
              title="Next Alert"
            >
              ▶
            </button>
          </div>
        )}

        {activeAlert.targetTab && (
          <button
            type="button"
            onClick={handleAction}
            style={{
              background: btnBg,
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeAlert.actionLabel || 'View Details'} ➔
          </button>
        )}

        <button
          type="button"
          onClick={() => dismissNotification(activeAlert.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: textColor,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            padding: '0 4px',
            lineHeight: 1,
            opacity: 0.7,
          }}
          title="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
