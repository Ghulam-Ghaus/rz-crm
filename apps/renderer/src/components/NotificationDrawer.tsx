import React, { useState } from 'react';
import { useNotifications, AppNotification, AlertSeverity } from '../context/NotificationContext.js';

interface NotificationDrawerProps {
  onNavigateTab: (tab: string, subTab?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ onNavigateTab }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    isDrawerOpen,
    setIsDrawerOpen,
  } = useNotifications();

  const [filterSeverity, setFilterSeverity] = useState<'ALL' | AlertSeverity>('ALL');

  if (!isDrawerOpen) return null;

  const activeList = notifications.filter(n => !n.isDismissed);
  const filtered = filterSeverity === 'ALL'
    ? activeList
    : activeList.filter(n => n.severity === filterSeverity);

  const handleActionClick = (alert: AppNotification) => {
    markAsRead(alert.id);
    setIsDrawerOpen(false);
    if (alert.targetTab) {
      onNavigateTab(alert.targetTab, alert.targetSubTab);
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
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={() => setIsDrawerOpen(false)}
    >
      <div
        style={{
          width: '380px',
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🔔</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Notifications & Alerts
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                {unreadCount > 0 ? `${unreadCount} unread system alert${unreadCount > 1 ? 's' : ''}` : 'All alerts caught up'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#64748b',
              fontWeight: 700,
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Action Controls & Filter Chips */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`tab-btn ${filterSeverity === 'ALL' ? 'active' : ''}`}
              style={{ fontSize: '10px', padding: '3px 8px' }}
              onClick={() => setFilterSeverity('ALL')}
            >
              All ({activeList.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${filterSeverity === 'CRITICAL' ? 'active' : ''}`}
              style={{ fontSize: '10px', padding: '3px 8px' }}
              onClick={() => setFilterSeverity('CRITICAL')}
            >
              Critical
            </button>
            <button
              type="button"
              className={`tab-btn ${filterSeverity === 'WARN' ? 'active' : ''}`}
              style={{ fontSize: '10px', padding: '3px 8px' }}
              onClick={() => setFilterSeverity('WARN')}
            >
              Warnings
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark read
              </button>
            )}
            {activeList.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {filtered.map(alert => {
            const isCrit = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                style={{
                  background: alert.isRead ? '#ffffff' : '#f8fafc',
                  border: `1px solid ${alert.isRead ? '#e2e8f0' : isCrit ? '#fecaca' : '#fed7aa'}`,
                  borderRadius: '6px',
                  padding: '10px',
                  marginBottom: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'background 0.2s',
                  position: 'relative',
                }}
              >
                {!alert.isRead && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: isCrit ? '#ef4444' : '#f59e0b',
                    }}
                    title="Unread"
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {alert.category === 'CHEQUE' ? '📑' : alert.category === 'RECEIVABLE' ? '💳' : alert.category === 'BACKUP' ? '💾' : '📦'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: 1.35 }}>
                      {alert.message}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: isCrit ? '#fee2e2' : '#fef3c7',
                      color: isCrit ? '#b91c1c' : '#b45309',
                    }}
                  >
                    {alert.severity}
                  </span>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {alert.targetTab && (
                      <button
                        type="button"
                        onClick={() => handleActionClick(alert)}
                        style={{
                          background: isCrit ? '#dc2626' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {alert.actionLabel || 'Go to'} ➔
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => dismissNotification(alert.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '2px',
                      }}
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                All clear! No alerts.
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                Business operations, cheque clearing, and backups are healthy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
