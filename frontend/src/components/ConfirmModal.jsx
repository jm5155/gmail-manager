/**
 * ConfirmModal.jsx — Confirmation Modal Component (Unified Neumorphic Design)
 * Centered overlay modal with title, message, Cancel + Confirm buttons.
 * Used before destructive actions (e.g., deleting emails, resetting database).
 * 
 * Props:
 *   title (string): Modal title
 *   message (string): Confirmation message
 *   confirmText (string): Confirm button text (default: "Confirm")
 *   isDangerous (bool): Use danger styling for destructive actions
 *   onConfirm (fn): Callback when confirmed
 *   onCancel (fn): Callback when cancelled
 * 
 * Updated: 2026-08-10 - Unified neumorphic design system
 */

import React from 'react';

function ConfirmModal({
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  isDangerous = false,
  onConfirm = () => {},
  onCancel = () => {},
}) {
  return (
    <div
      className="modal-overlay fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="modal-content w-full max-w-md mx-4 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: isDangerous ? 'var(--danger-bg)' : 'var(--warning-bg)',
              border: `2px solid ${isDangerous ? 'var(--danger-border)' : 'var(--warning-border)'}`,
            }}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              style={{ color: isDangerous ? 'var(--danger)' : 'var(--warning)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-primary text-center mb-2">{title}</h3>

        {/* Message */}
        <p className="text-sm text-secondary text-center mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={isDangerous ? 'btn-danger flex-1' : 'btn-primary flex-1'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
