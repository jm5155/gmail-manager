/**
 * EmailCard.jsx — Email List Card Component (Light Design System)
 * Reusable card for displaying email in Inbox and Scam Alerts.
 * Shows sender avatar, name, subject, date, label chip, and scam badge.
 * Click to expand email snippet and scam analysis (inline accordion).
 * 
 * Updated: 2026-08-11 - Light design system with clean, modern aesthetics
 */

import React, { useState } from 'react';
import ScamBadge from './ScamBadge';
import { decodeHTMLEntities } from '../utils/htmlDecode';

function EmailCard({ 
  email, 
  showScamBadge = true, 
  actions = null, 
  onLabelUpdate = null, 
  onLabelChange = null, 
  pendingLabel = null, 
  availableLabels = [] 
}) {
  const [expanded, setExpanded] = useState(false);
  const [scamExpanded, setScamExpanded] = useState(false);

  // Get the label display name from API field
  const labelName = email.label_name || email.label || 'Uncategorized';

  // Get sender name
  const senderName = email.sender?.split('<')[0]?.trim()?.replace(/"/g, '') || 'Unknown';
  
  // Deterministic avatar color selection
  const getAvatarColor = (name) => {
    const colors = [
      { bg: '#5B5CE2', name: 'primary' },    // Primary indigo
      { bg: '#27AE72', name: 'success' },    // Success green
      { bg: '#E5A23C', name: 'warning' },    // Warning orange
      { bg: '#3B82F6', name: 'info' }        // Info blue
    ];
    
    // Simple hash function for deterministic color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  // Get avatar initials and color
  const getAvatarInitials = (name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const avatarColor = getAvatarColor(senderName);
  const avatarInitials = getAvatarInitials(senderName);

  // Decode HTML entities in subject and snippet (fixes &#39; bug)
  const decodedSubject = decodeHTMLEntities(email.subject) || '(No Subject)';
  const decodedSnippet = decodeHTMLEntities(email.snippet) || '';

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Build combined label list for dropdown
  const combinedLabels = [...availableLabels];

  // Parse scam indicators
  const indicators = email.scam_indicators
    ? (typeof email.scam_indicators === 'string' ? JSON.parse(email.scam_indicators) : email.scam_indicators)
    : [];

  return (
    <div 
      className="bg-surface rounded-xl overflow-visible transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-surface, #F8F9FB)',
        border: '1px solid var(--color-border, #E1E5EB)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)';
      }}
    >
      {/* Main Card Content */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer p-5"
      >
        {/* DESKTOP LAYOUT (≥768px) */}
        <div className="hidden md:flex items-center gap-4">
          {/* Sender Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{
              backgroundColor: avatarColor.bg,
            }}
          >
            {avatarInitials}
          </div>

          {/* Email Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <span 
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary, #20242C)' }}
              >
                {senderName}
              </span>
              <span 
                className="text-xs flex-shrink-0"
                style={{ color: 'var(--color-text-muted, #9AA3B2)' }}
              >
                {formatDate(email.analyzed_at || email.date)}
              </span>
            </div>
            <p 
              className="text-sm truncate mt-0.5"
              style={{ color: 'var(--color-text-primary, #20242C)' }}
            >
              {decodedSubject}
            </p>
            {!expanded && (
              <p 
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--color-text-secondary, #687386)' }}
              >
                {decodedSnippet}
              </p>
            )}
          </div>

          {/* Label Dropdown */}
          {availableLabels.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={pendingLabel || labelName || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onLabelChange) onLabelChange(email.email_id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-3 py-1.5 cursor-pointer rounded-lg transition-all"
                style={{
                  backgroundColor: 'var(--color-surface, #F8F9FB)',
                  border: '1px solid var(--color-border, #E1E5EB)',
                  color: 'var(--color-text-primary, #20242C)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                {combinedLabels.map(label => (
                  <option key={label.label_id} value={label.label_name}>
                    {label.label_name}
                  </option>
                ))}
              </select>
              {pendingLabel && (
                <span style={{ color: 'var(--color-warning, #E5A23C)' }} className="text-xs">●</span>
              )}
            </div>
          )}

          {/* Status Badges */}
          {email.status === 'fetched' && (
            <span 
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{
                backgroundColor: 'rgba(229, 162, 60, 0.1)',
                color: 'var(--color-warning, #E5A23C)',
              }}
            >
              ⏳ Analyzing...
            </span>
          )}
          {email.status === 'failed' && (
            <span 
              className="text-xs px-3 py-1 rounded-full font-medium cursor-help"
              style={{
                backgroundColor: 'rgba(224, 90, 103, 0.1)',
                color: 'var(--color-danger, #E05A67)',
              }}
              title={email.error_reason ? `Failed: ${email.error_reason}` : 'Analysis failed - will retry automatically'}
            >
              ⚠ Analysis Failed {email.retry_count > 0 && `(${email.retry_count} retries)`}
            </span>
          )}
        </div>

        {/* MOBILE LAYOUT (<768px) */}
        <div className="md:hidden space-y-2.5">
          {/* Row 1: Avatar + Sender | Timestamp */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{
                  backgroundColor: avatarColor.bg,
                }}
              >
                {avatarInitials}
              </div>
              <span 
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary, #20242C)' }}
              >
                {senderName}
              </span>
            </div>
            <span 
              className="text-xs flex-shrink-0"
              style={{ color: 'var(--color-text-muted, #9AA3B2)' }}
            >
              {formatDate(email.analyzed_at || email.date)}
            </span>
          </div>

          {/* Row 2: Subject */}
          <p 
            className="text-sm line-clamp-2 leading-snug"
            style={{ color: 'var(--color-text-primary, #20242C)' }}
          >
            {decodedSubject}
          </p>

          {/* Row 3: Snippet */}
          {!expanded && (
            <p 
              className="text-xs truncate leading-relaxed"
              style={{ color: 'var(--color-text-secondary, #687386)' }}
            >
              {decodedSnippet}
            </p>
          )}

          {/* Row 4: Label + Status */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {availableLabels.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={pendingLabel || labelName || ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (onLabelChange) onLabelChange(email.email_id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-2.5 py-1 cursor-pointer rounded-lg transition-all"
                    style={{
                      backgroundColor: 'var(--color-surface, #F8F9FB)',
                      border: '1px solid var(--color-border, #E1E5EB)',
                      color: 'var(--color-text-primary, #20242C)',
                      boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    {combinedLabels.map(label => (
                      <option key={label.label_id} value={label.label_name}>
                        {label.label_name}
                      </option>
                    ))}
                  </select>
                  {pendingLabel && (
                    <span style={{ color: 'var(--color-warning, #E5A23C)' }} className="text-xs">●</span>
                  )}
                </div>
              )}

              {/* Status Badges */}
              {email.status === 'fetched' && (
                <span 
                  className="text-[10px] md:text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: 'rgba(229, 162, 60, 0.1)',
                    color: 'var(--color-warning, #E5A23C)',
                  }}
                >
                  ⏳ Analyzing...
                </span>
              )}
              {email.status === 'failed' && (
                <span 
                  className="text-[10px] md:text-xs px-2.5 py-1 rounded-full font-medium cursor-help"
                  style={{
                    backgroundColor: 'rgba(224, 90, 103, 0.1)',
                    color: 'var(--color-danger, #E05A67)',
                  }}
                  title={email.error_reason ? `Failed: ${email.error_reason}` : 'Analysis failed - will retry automatically'}
                >
                  ⚠ Failed {email.retry_count > 0 && `(${email.retry_count}x)`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scam Badge - Outside main content, always visible */}
      {showScamBadge && email.scam_score != null && (
        <div className="px-5 pb-3" onClick={(e) => e.stopPropagation()}>
          <ScamBadge
            score={email.scam_score}
            reason={email.scam_reason || ''}
            indicators={indicators}
            expanded={scamExpanded}
            onToggle={() => setScamExpanded(!scamExpanded)}
          />
        </div>
      )}

      {/* Expanded Content (Full Email Snippet) */}
      {expanded && (
        <div 
          className="px-5 pb-5 pt-2"
          style={{
            borderTop: '1px solid var(--color-border, #E1E5EB)',
          }}
        >
          <p 
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--color-text-secondary, #687386)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {decodedSnippet || 'No preview available'}
          </p>
        </div>
      )}

      {/* Custom Actions (e.g., delete, move) */}
      {actions && (
        <div 
          className="px-5 pb-4 flex gap-2 pt-3"
          style={{
            borderTop: '1px solid var(--color-border, #E1E5EB)',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export default EmailCard;
