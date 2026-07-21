/**
 * ToastNotification.jsx — Toast Notification Component (Phase 9)
 * Top-right corner auto-dismiss toasts with success/warning/error types.
 * 
 * Usage: import { ToastProvider, useToast } from './ToastNotification';
 * Wrap app in <ToastProvider>, then call toast.success('message') anywhere.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Toast context
const ToastContext = createContext(null);

// Toast type configurations
const TOAST_TYPES = {
  success: {
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.25)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.25)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  error: {
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.25)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback((type, message, subtext = '') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message, subtext }]);

    // Auto-dismiss after 4 seconds
    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, 4000);

    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, sub) => addToast('success', msg, sub),
    warning: (msg, sub) => addToast('warning', msg, sub),
    error: (msg, sub) => addToast('error', msg, sub),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] space-y-3 pointer-events-none" style={{ width: '380px' }}>
        {toasts.map((t) => {
          const config = TOAST_TYPES[t.type] || TOAST_TYPES.success;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl"
              style={{
                background: config.bg,
                border: `1px solid ${config.border}`,
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.4)',
                animation: 'slideIn 0.3s ease-out',
              }}
            >
              <span style={{ color: config.color }} className="flex-shrink-0 mt-0.5">
                {config.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{t.message}</p>
                {t.subtext && (
                  <p className="text-xs text-text-secondary mt-0.5">{t.subtext}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
