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
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo = '';
    if (diffMins < 60) timeAgo = `${diffMins} min ago`;
    else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else if (diffDays < 7) timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    const formatted = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return timeAgo ? `${timeAgo}, ${formatted}` : formatted;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with sender info and close button */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
              style={{
                backgroundColor: 'var(--color-text-muted)',
              }}
            >
              {senderName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            
            <div>
              <h3 
                className="text-base font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {senderName}
              </h3>
              <p 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {senderEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {formatDate(email.date)}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex h-[calc(90vh-80px)]">
          {/* Left: Reply section */}
          <div
            className="w-2/5 flex flex-col p-6"
            style={{
              backgroundColor: 'var(--color-background)',
              borderRight: '1px solid var(--color-border)',
            }}
          >
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-medium">To:</span> {senderName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-medium">Subject:</span> {decodedSubject}
              </p>
            </div>

            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your reply..."
              className="flex-1 text-sm rounded-lg p-3 resize-none mb-4"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendReply}
                disabled={!replyBody.trim() || sending}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: replyBody.trim() && !sending ? 'var(--color-primary)' : 'var(--color-border)',
                  color: '#ffffff',
                }}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Attach file"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="More options"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: Email content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Scam badge if applicable */}
            {email.scam_score !== null && email.scam_score !== undefined && (
              <div className="mb-4">
                <ScamBadge
                  score={email.scam_score}
                  reason={email.scam_reason}
                  indicators={indicators}
                  expanded={false}
                  onToggle={() => {}}
                />
              </div>
            )}

            {/* Email body */}
            <EmailBodyFrame 
              body={email.body || email.snippet} 
              className="text-sm" 
              textStyle={{ color: 'var(--color-text-primary)' }} 
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EmailDetailModal;
