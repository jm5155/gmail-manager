/**
 * ConfirmModal.jsx — Confirmation Modal Component (Phase 9)
 * Centered overlay modal with title, body text, Cancel + Confirm buttons.
 * Used before any destructive action (e.g., deleting emails).
 * 
 * Props:
 *   isOpen (bool), title (string), message (string),
 *   onConfirm (fn), onCancel (fn), confirmLabel (string), danger (bool)
 */

import React from 'react';

function ConfirmModal({
  isOpen = false,
  title = 'Confirm Action',
  message = 'Are you sure?',
  onConfirm = () => {},
  onCancel = () => {},
  confirmLabel = 'Confirm',
  danger = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl p-6"
        style={{
          background: '#1E293B',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              style={{ color: danger ? '#EF4444' : '#F59E0B' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-text-primary text-center mb-2">{title}</h3>

        {/* Message */}
        <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-text-secondary
                       transition-all duration-200 hover:text-text-primary hover:bg-surface"
            style={{ border: '1px solid #334155' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white
                       transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            style={{
              background: danger
                ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default ConfirmModal;
