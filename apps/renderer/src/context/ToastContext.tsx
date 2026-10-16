import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  timestamp: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastMessage = {
        id,
        type,
        title,
        message,
        duration,
        timestamp: Date.now(),
      };

      setToasts(prev => [...prev.slice(-4), newToast]); // keep max 5 visible toasts

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  const success = useCallback((msg: string, title?: string, dur?: number) => showToast('success', msg, title, dur), [showToast]);
  const error = useCallback((msg: string, title?: string, dur?: number) => showToast('error', msg, title, dur), [showToast]);
  const warning = useCallback((msg: string, title?: string, dur?: number) => showToast('warning', msg, title, dur), [showToast]);
  const info = useCallback((msg: string, title?: string, dur?: number) => showToast('info', msg, title, dur), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismissToast }}>
      {children}

      {/* Floating Toast Container */}
      <aside
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          let borderColor = '#22c55e';
          let icon = '✅';
          let titleText = toast.title || 'Success';

          if (toast.type === 'error') {
            borderColor = '#ef4444';
            icon = '❌';
            titleText = toast.title || 'Error';
          } else if (toast.type === 'warning') {
            borderColor = '#f59e0b';
            icon = '⚠️';
            titleText = toast.title || 'Warning';
          } else if (toast.type === 'info') {
            borderColor = '#3b82f6';
            icon = 'ℹ️';
            titleText = toast.title || 'Information';
          }

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: '#ffffff',
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '6px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                borderTop: '1px solid #f1f5f9',
                borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #f1f5f9',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '15px', lineHeight: 1.2, marginTop: '1px' }}>{icon}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                  {titleText}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.35, wordBreak: 'break-word' }}>
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                  alignSelf: 'flex-start',
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};
