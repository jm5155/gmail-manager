/**
 * EmailDetailModal.jsx — Redesigned Email Detail Modal
 * 
 * IMPROVEMENTS (2026-09-11):
 * - Single-column layout for better readability
 * - Security indicators moved to top with clear visual hierarchy
 * - Sender verification badge prominent in header
 * - Collapsible reply section to reduce clutter
 * - Better mobile responsiveness
 * - Improved scam badge positioning and visibility
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ScamBadge from './ScamBadge';
import { apiPost } from '../lib/api';
import { useToast } from './ToastNotification';
import EmailBodyFrame from './EmailBodyFrame';

function EmailDetailModal({ email, senderName, senderEmail, decodedSubject, indicators, onClose }) {
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [scamExpanded, setScamExpanded] = useState(false);
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
        setShowReply(false);
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

  // Determine sender trust level
  const getSenderTrustLevel = () => {
    const score = email.scam_score || 0;
    if (score >= 70) return { level: 'dangerous', label: 'Unverified Sender', color: 'var(--color-danger)' };
    if (score >= 40) return { level: 'suspicious', label: 'Unknown Sender', color: 'var(--color-warning)' };
    return { level: 'safe', label: 'Verified Sender', color: 'var(--color-success)' };
  };

  const senderTrust = getSenderTrustLevel();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with sender info and trust badge */}
        <div
          className="px-6 py-4 flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                style={{
                  backgroundColor: 'var(--color-primary)',
                }}
              >
                {senderName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 
                    className="text-lg font-semibold truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {senderName}
                  </h3>
                  
                  {/* Sender trust badge */}
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0"
                    style={{
                      backgroundColor: `${senderTrust.color}20`,
                      color: senderTrust.color,
                      border: `1px solid ${senderTrust.color}40`,
                    }}
                  >
                    {senderTrust.level === 'safe' ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {senderTrust.label}
                  </span>
                </div>
                
                <p 
                  className="text-sm truncate mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {senderEmail}
                </p>
                
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(email.date)}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Security alert - prominent if high risk */}
          {email.scam_score !== null && email.scam_score !== undefined && email.scam_score >= 40 && (
            <div 
              className="mx-6 mt-4"
              style={{
                backgroundColor: email.scam_score >= 70 ? 'rgba(224, 90, 103, 0.05)' : 'rgba(229, 162, 60, 0.05)',
                border: `1px solid ${email.scam_score >= 70 ? 'var(--color-danger)' : 'var(--color-warning)'}40`,
                borderRadius: '12px',
                padding: '12px 16px',
              }}
            >
              <div className="flex items-start gap-3">
                <svg 
                  className="w-5 h-5 flex-shrink-0 mt-0.5" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  style={{ color: email.scam_score >= 70 ? 'var(--color-danger)' : 'var(--color-warning)' }}
                >
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    {email.scam_score >= 70 ? '⚠️ High Security Risk Detected' : '⚠️ Suspicious Email'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    This email shows signs of phishing or fraud. Avoid clicking links or providing personal information.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="px-6 pt-5 pb-4">
            <h2 
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)', lineHeight: '1.4' }}
            >
              {decodedSubject || '(No Subject)'}
            </h2>
          </div>

          {/* Scam badge - always visible but less prominent for low scores */}
          {email.scam_score !== null && email.scam_score !== undefined && (
            <div className="px-6 pb-4">
              <ScamBadge
                score={email.scam_score}
                reason={email.scam_reason}
                indicators={indicators}
                expanded={scamExpanded}
                onToggle={() => setScamExpanded(!scamExpanded)}
              />
            </div>
          )}

          {/* Email body */}
          <div 
            className="px-6 pb-6"
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '1.5rem',
            }}
          >
            <EmailBodyFrame 
              body={email.body || email.snippet} 
              className="text-sm" 
              textStyle={{ color: 'var(--color-text-primary)', lineHeight: '1.7' }} 
            />
          </div>
        </div>

        {/* Bottom action bar */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-background)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setShowReply(!showReply)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              backgroundColor: showReply ? 'var(--color-primary)' : 'var(--color-surface)',
              color: showReply ? '#ffffff' : 'var(--color-text-primary)',
              border: showReply ? 'none' : '1px solid var(--color-border)',
            }}
            onMouseEnter={(e) => {
              if (!showReply) {
                e.currentTarget.style.backgroundColor = 'var(--color-border)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showReply) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {showReply ? 'Hide Reply' : 'Reply'}
          </button>

          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="More actions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Collapsible reply section */}
        {showReply && (
          <div
            className="px-6 py-4 flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              maxHeight: '300px',
            }}
          >
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-medium">To:</span> {senderName} &lt;{senderEmail}&gt;
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-medium">Subject:</span> Re: {decodedSubject}
              </p>
            </div>

            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your reply..."
              className="w-full text-sm rounded-lg p-3 resize-none mb-3"
              rows={4}
              style={{
                backgroundColor: 'var(--color-background)',
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: replyBody.trim() && !sending ? 'var(--color-primary)' : 'var(--color-border)',
                  color: '#ffffff',
                }}
              >
                {sending ? 'Sending...' : 'Send Reply'}
              </button>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-border)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Attach file"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default EmailDetailModal;
