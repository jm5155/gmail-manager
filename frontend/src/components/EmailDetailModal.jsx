import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ScamBadge from './ScamBadge';
import { apiPost } from '../lib/api';
import { useToast } from './ToastNotification';
import EmailBodyFrame from './EmailBodyFrame';

function EmailDetailModal({ email, senderName, senderEmail, decodedSubject, indicators, onClose }) {
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSendReply = async () => {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    try {
      const result = await apiPost(`/emails/${email.email_id || email.id}/reply`, {
        body: replyBody,
      });
      if (result && result.error) {
        toast.error('Failed to send reply', result.error);
      } else {
        toast.success('Reply sent', 'Your reply was sent successfully.');
        setReplyBody('');
        onClose();
      }
    } catch (err) {
      toast.error('Failed to send reply', err.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const labelName = email.label_name || email.label || 'Uncategorized';

  // Rendered via portal directly into document.body so this overlay is never
  // nested inside a per-row wrapper that has its own z-index (see Inbox.jsx,
  // where each email row gets `position: relative; zIndex: ...`). Any
  // positioned ancestor with an explicit z-index creates a NEW stacking
  // context, which traps this modal's z-50 inside that row instead of
  // comparing it against the whole page (header, toolbar, other cards) —
  // that's what caused the toolbar/header to visually overlap the modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-start justify-between gap-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 
                className="text-base font-semibold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {senderName}
              </h3>
            </div>
            <p 
              className="text-sm truncate mt-0.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {senderEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Subject */}
          <div>
            <h2 
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {decodedSubject}
            </h2>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatDate(email.analyzed_at || email.date)}
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--color-surface-light)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {labelName}
            </span>
          </div>

          {/* Scam Badge */}
          {email.scam_score != null && (
            <ScamBadge
              score={email.scam_score}
              reason={email.scam_reason || ''}
              indicators={indicators}
              expanded={true}
              onToggle={() => {}}
            />
          )}

          {/* Body */}
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--color-surface-light)',
              border: '1px solid var(--color-border)',
            }}
          >
            <EmailBodyFrame 
              body={email.body || email.snippet} 
              className="text-sm leading-relaxed" 
              textStyle={{ color: 'var(--color-text-primary)' }} 
            />
          </div>

          {/* Reply Section */}
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--color-surface-light)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="text-xs mb-3 space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
              <p><span className="font-medium">To:</span> {senderName}</p>
              <p><span className="font-medium">Subject:</span> Re: {decodedSubject}</p>
            </div>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your reply..."
              rows={4}
              className="w-full text-sm rounded-lg p-3 resize-y transition-all"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSendReply}
                disabled={sending || !replyBody.trim()}
                className="text-sm font-medium px-5 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: (sending || !replyBody.trim()) ? 'var(--color-border)' : 'var(--color-primary)',
                  color: (sending || !replyBody.trim()) ? 'var(--color-text-muted)' : '#fff',
                  cursor: (sending || !replyBody.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending...' : 'Send Reply'}
              </button>
              <button
                onClick={() => setReplyBody('')}
                className="text-sm font-medium px-5 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EmailDetailModal;
