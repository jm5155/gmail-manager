/**
 * EmailCard.jsx — Email List Card Component (Unified Neumorphic Design)
 * Reusable card for displaying email in Inbox and Scam Alerts.
 * Shows sender avatar, name, subject, date, label chip, and scam badge.
 * Click to expand email snippet and scam analysis (inline accordion).
 * 
 * Updated: 2026-08-10 - Unified neumorphic design system
 */

import React, { useState } from 'react';
import ScamBadge from './ScamBadge';
import { getAvatarProps } from '../utils/avatarColors';
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

  // Get sender name and avatar props
  const senderName = email.sender?.split('<')[0]?.trim()?.replace(/"/g, '') || 'Unknown';
  const avatar = getAvatarProps(senderName);

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
    <div className="neu-card p-0 overflow-visible">
      {/* Main Card Content */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer p-5"
      >
        {/* DESKTOP LAYOUT (≥768px) */}
        <div className="hidden md:flex items-center gap-4">
          {/* Sender Avatar */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 bg-gradient-to-br ${avatar.gradient.tailwind.from} ${avatar.gradient.tailwind.to}`}
          >
            {avatar.initials}
          </div>

          {/* Email Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-white truncate">{senderName}</span>
              <span className="text-xs text-muted flex-shrink-0">{formatDate(email.analyzed_at || email.date)}</span>
            </div>
            <p className="text-sm text-white truncate mt-0.5">
              {decodedSubject}
            </p>
            {!expanded && (
              <p className="text-xs text-gray truncate mt-0.5">{decodedSnippet}</p>
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
                className="neu-input text-xs px-3 py-1.5 cursor-pointer"
              >
                {combinedLabels.map(label => (
                  <option key={label.label_id} value={label.label_name}>
                    {label.label_name}
                  </option>
                ))}
              </select>
              {pendingLabel && (
                <span className="text-warning text-xs">●</span>
              )}
            </div>
          )}

          {/* Status Badges */}
          {email.status === 'fetched' && (
            <span className="badge badge-warning">
              ⏳ Analyzing...
            </span>
          )}
          {email.status === 'failed' && (
            <span 
              className="badge badge-danger cursor-help"
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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 bg-gradient-to-br ${avatar.gradient.tailwind.from} ${avatar.gradient.tailwind.to}`}
              >
                {avatar.initials}
              </div>
              <span className="text-sm font-medium text-white truncate">{senderName}</span>
            </div>
            <span className="text-xs text-muted flex-shrink-0">{formatDate(email.analyzed_at || email.date)}</span>
          </div>

          {/* Row 2: Subject */}
          <p className="text-sm text-white line-clamp-2 leading-snug">
            {decodedSubject}
          </p>

          {/* Row 3: Snippet */}
          {!expanded && (
            <p className="text-xs text-gray truncate leading-relaxed">
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
                    className="neu-input text-xs px-2.5 py-1 cursor-pointer"
                  >
                    {combinedLabels.map(label => (
                      <option key={label.label_id} value={label.label_name}>
                        {label.label_name}
                      </option>
                    ))}
                  </select>
                  {pendingLabel && (
                    <span className="text-warning text-xs">●</span>
                  )}
                </div>
              )}

              {/* Status Badges */}
              {email.status === 'fetched' && (
                <span className="badge badge-warning text-[10px] md:text-xs">
                  ⏳ Analyzing...
                </span>
              )}
              {email.status === 'failed' && (
                <span 
                  className="badge badge-danger text-[10px] md:text-xs cursor-help"
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
        <div className="px-5 pb-5 pt-2 border-t border-subtle">
          <p 
            className="text-sm text-gray leading-relaxed"
            style={{
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
        <div className="px-5 pb-4 flex gap-2 border-t border-subtle pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}

export default EmailCard;
