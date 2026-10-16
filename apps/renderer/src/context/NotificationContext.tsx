import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type AlertSeverity = 'CRITICAL' | 'WARN' | 'INFO';
export type AlertCategory = 'CHEQUE' | 'RECEIVABLE' | 'STOCK' | 'BACKUP' | 'SECURITY' | 'SYSTEM';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  targetTab?: string;
  targetSubTab?: string;
  actionLabel?: string;
  timestamp: string;
  isRead: boolean;
  isDismissed: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  criticalAlerts: AppNotification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  refreshAlerts: () => Promise<void>;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};

export const NotificationProvider: React.FC<{
  storeId: number;
  children: React.ReactNode;
}> = ({ storeId, children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Background scanner
  const refreshAlerts = useCallback(async () => {
    if (!window.bakery) return;

    const freshAlerts: AppNotification[] = [];
    const nowStr = new Date().toISOString();

    // 1. Scan Cheque Register for Overdue & Due-Today Cheques
    if (window.bakery.reports?.getChequeRegister) {
      try {
        const chequeRes = await window.bakery.reports.getChequeRegister(storeId);
        if (chequeRes.success && chequeRes.data) {
          const report = chequeRes.data;
          const pendingCheques = report.cheques.filter(c => c.status === 'POSTED');
          const overdueCheques = pendingCheques.filter(c => c.daysUntilMaturity < 0);
          const dueTodayCheques = pendingCheques.filter(c => c.daysUntilMaturity === 0);

          if (overdueCheques.length > 0) {
            const sumRs = (overdueCheques.reduce((acc, c) => acc + c.amountMinorUnits, 0) / 100).toFixed(2);
            freshAlerts.push({
              id: 'cheques-overdue',
              title: `⚠️ ${overdueCheques.length} Overdue Cheques Pending`,
              message: `Total overdue: Rs. ${Number(sumRs).toLocaleString()} across ${overdueCheques.length} inward/outward cheques.`,
              severity: 'CRITICAL',
              category: 'CHEQUE',
              targetTab: 'reports',
              targetSubTab: 'financial',
              actionLabel: 'Review Cheques',
              timestamp: nowStr,
              isRead: false,
              isDismissed: false,
            });
          }

          if (dueTodayCheques.length > 0) {
            const sumRs = (dueTodayCheques.reduce((acc, c) => acc + c.amountMinorUnits, 0) / 100).toFixed(2);
            freshAlerts.push({
              id: 'cheques-due-today',
              title: `⏳ ${dueTodayCheques.length} Cheques Maturing Today`,
              message: `Clearing scheduled today for Rs. ${Number(sumRs).toLocaleString()}. Present to bank for clearing.`,
              severity: 'WARN',
              category: 'CHEQUE',
              targetTab: 'reports',
              targetSubTab: 'financial',
              actionLabel: 'Open Forecast',
              timestamp: nowStr,
              isRead: false,
              isDismissed: false,
            });
          }
        }
      } catch {
        // Ignored
      }
    }

    // 2. Scan Customer Receivables for Critical 90+ Day Delinquent Debt
    if (window.bakery.reports?.getReceivablesAgeing) {
      try {
        const recRes = await window.bakery.reports.getReceivablesAgeing(storeId);
        if (recRes.success && recRes.data) {
          const report = recRes.data;
          if (report.total90PlusMinorUnits > 0) {
            const criticalRs = (report.total90PlusMinorUnits / 100).toFixed(2);
            freshAlerts.push({
              id: 'receivables-critical',
              title: `🚨 Critical 90+ Days Customer Receivables`,
              message: `Rs. ${Number(criticalRs).toLocaleString()} overdue past 90 days. Immediate credit freeze recommended.`,
              severity: 'CRITICAL',
              category: 'RECEIVABLE',
              targetTab: 'reports',
              targetSubTab: 'financial',
              actionLabel: 'Ageing Analysis',
              timestamp: nowStr,
              isRead: false,
              isDismissed: false,
            });
          }
        }
      } catch {
        // Ignored
      }
    }

    // 3. Scan Backup Status
    if (window.bakery.backup?.getStatus) {
      try {
        const backupRes = await window.bakery.backup.getStatus();
        if (backupRes.success && backupRes.data) {
          const status = backupRes.data;
          if (status.totalBackups === 0) {
            freshAlerts.push({
              id: 'backup-none',
              title: `💾 No Disaster Recovery Snapshots Exist`,
              message: `No backup snapshots found. Create a database backup to protect business data.`,
              severity: 'CRITICAL',
              category: 'BACKUP',
              targetTab: 'reports',
              targetSubTab: 'backup',
              actionLabel: 'Create Backup',
              timestamp: nowStr,
              isRead: false,
              isDismissed: false,
            });
          } else if (status.lastBackupAtUtc) {
            const ageHours = (Date.now() - new Date(status.lastBackupAtUtc).getTime()) / (1000 * 60 * 60);
            if (ageHours > 24) {
              freshAlerts.push({
                id: 'backup-stale',
                title: `⚠️ Database Backup Overdue (>24 Hours)`,
                message: `Last verified backup was taken ${Math.floor(ageHours)} hours ago. Take a fresh snapshot.`,
                severity: 'WARN',
                category: 'BACKUP',
                targetTab: 'reports',
                targetSubTab: 'backup',
                actionLabel: 'Backup Now',
                timestamp: nowStr,
                isRead: false,
                isDismissed: false,
              });
            }
          }
        }
      } catch {
        // Ignored
      }
    }

    // 4. Scan Stock for Negative or Depleted Inventory
    if (window.bakery.reports?.getStockValuation) {
      try {
        const stockRes = await window.bakery.reports.getStockValuation(storeId);
        if (stockRes.success && stockRes.data) {
          const depleted = stockRes.data.items.filter(i => i.quantityOnHand <= 0);
          if (depleted.length > 0) {
            freshAlerts.push({
              id: 'stock-depleted',
              title: `📦 ${depleted.length} Items Out of Stock or Negative`,
              message: `Items such as "${depleted[0].productName}" require immediate re-ordering or physical inventory count.`,
              severity: 'WARN',
              category: 'STOCK',
              targetTab: 'inventory',
              actionLabel: 'Stock Audit',
              timestamp: nowStr,
              isRead: false,
              isDismissed: false,
            });
          }
        }
      } catch {
        // Ignored
      }
    }

    setNotifications(prev => {
      // Merge while preserving dismissed and read states
      const dismissedIds = new Set(prev.filter(p => p.isDismissed).map(p => p.id));
      const readIds = new Set(prev.filter(p => p.isRead).map(p => p.id));

      return freshAlerts.map(alert => ({
        ...alert,
        isDismissed: dismissedIds.has(alert.id),
        isRead: readIds.has(alert.id),
      }));
    });
  }, [storeId]);

  // Initial scan + periodic 60s background monitor
  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 60000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isDismissed: true } : n)));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isDismissed: true, isRead: true })));
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead && !n.isDismissed).length;
  }, [notifications]);

  const criticalAlerts = useMemo(() => {
    return notifications.filter(n => !n.isDismissed && (n.severity === 'CRITICAL' || n.severity === 'WARN'));
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        criticalAlerts,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        clearAll,
        refreshAlerts,
        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
