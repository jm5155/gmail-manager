/**
 * EmailCard.jsx — Email List Card Component (Neumorphic Design)
 * Reusable card for displaying email in Inbox and Scam Alerts.
 * Shows sender avatar with gradient, name, subject, date, label chip, and scam badge.
 * Click to expand and show email snippet.
 * 
 * Updated: 2026-07-25 - Neumorphic dark gradient design system
 */

import React, { useState } from 'react';
import ScamBadge from './ScamBadge';
import { getAvatarProps } from '../utils/avatarColors';
import { decodeHTMLEntities } from '../utils/htmlDecode';

// Default fallback label style
const DEFAULT_LABEL_STYLE = { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8' };

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

  // Get the label display name from new API field
  const labelName = email.label_name || email.label || 'Uncategorized';

  // Get sender name and avatar props using new gradient utility
  const senderName = email.sender?.split('<')[0]?.trim()?.replace(/"/g, '') || 'Unknown';
  const avatar = getAvatarProps(senderName);

  // Decode HTML entities in subject and snippet
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

  // Label chip colors — prefer API-provided colors, fall back to available labels lookup
  let labelStyle = DEFAULT_LABEL_STYLE;
  if (email.label_color_bg && email.label_color_text) {
    labelStyle = { bg: email.label_color_bg, text: email.label_color_text };
  } else {
    const matchingLabel = availableLabels.find(l => l.label_name === labelName);
    if (matchingLabel) {
      labelStyle = { bg: matchingLabel.color_bg, text: matchingLabel.color_text };
    }
  }

  // Build combined label list for override dropdown
  const combinedLabels = [...availableLabels];

  // Parse scam indicators
  const indicators = email.scam_indicators
    ? (typeof email.scam_indicators === 'string' ? JSON.parse(email.scam_indicators) : email.scam_indicators)
    : [];

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="relative bg-navy-800 rounded-card shadow-neumorphic-md hover:shadow-hover-lift hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden"
      style={{
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Gradient Accent Bar (Left Edge) */}
      <div className="accent-bar-primary" />

      {/* DESKTOP LAYOUT (≥768px) - Original Single Row */}
      <div className="hidden md:flex items-center gap-4 p-5">
        {/* Sender Avatar - Two-tone gradient */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 bg-gradient-to-br ${avatar.gradient.tailwind.from} ${avatar.gradient.tailwind.to}`}
        >
          {avatar.initials}
        </div>

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white truncate">{senderName}</span>
            <span className="text-xs text-lavender-400 flex-shrink-0">{formatDate(email.analyzed_at || email.date)}</span>
          </div>
          <p className="text-sm text-white truncate mt-0.5">
            {decodedSubject}
          </p>
          {!expanded && (
            <p className="text-xs text-lavender-400 truncate mt-0.5">{decodedSnippet}</p>
          )}
        </div>

        {/* Label Dropdown (Phase 36) */}
        {availableLabels.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={pendingLabel || labelName || ''}
              onChange={(e) => {
                e.stopPropagation();
                if (onLabelChange) onLabelChange(email.email_id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="select-neumorphic text-xs px-3 py-1.5 rounded-full cursor-pointer"
              style={{
                background: pendingLabel ? 'rgba(234, 179, 8, 0.1)' : labelStyle.bg,
                color: labelStyle.text,
              }}
            >
              {combinedLabels.map(label => (
                <option key={label.label_id} value={label.label_name}>
                  {label.label_name}
                </option>
              ))}
            </select>
            {pendingLabel && (
              <span className="text-yellow-400 text-xs">●</span>
            )}
          </div>
        )}

        {/* Status Badges */}
        {email.status === 'fetched' && (
          <span className="badge-status bg-yellow-500/15 text-yellow-400">
            ⏳ Analyzing...
          </span>
        )}
        {email.status === 'failed' && (
          <span className="badge-status bg-red-500/15 text-red-400">
            ⚠ Analysis Failed
          </span>
        )}

        {/* Scam Badge */}
        {showScamBadge && email.scam_score > 0 && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <ScamBadge
              score={email.scam_score}
              reason={email.scam_reason || ''}
              indicators={indicators}
            />
          </div>
        )}
      </div>

      {/* MOBILE LAYOUT (<768px) - 4-Row Stacked Structure (Phase 16) */}
      <div className="md:hidden p-4 space-y-2.5">
        {/* Row 1: Avatar + Sender Name | Timestamp */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Smaller Avatar on Mobile - Two-tone gradient */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 bg-gradient-to-br ${avatar.gradient.tailwind.from} ${avatar.gradient.tailwind.to}`}
            >
              {avatar.initials}
            </div>
            {/* Sender Name - truncate if too long */}
            <span className="text-sm font-medium text-white truncate">{senderName}</span>
          </div>
          {/* Timestamp - right-aligned */}
          <span className="text-xs text-lavender-400 flex-shrink-0">{formatDate(email.analyzed_at || email.date)}</span>
        </div>

        {/* Row 2: Subject Line - Up to 2 lines, wrap allowed */}
        <p className="text-sm text-white line-clamp-2 leading-snug">
          {decodedSubject}
        </p>

        {/* Row 3: Snippet Preview - Single line with ellipsis */}
        {!expanded && (
          <p className="text-xs text-lavender-400 truncate leading-relaxed">
            {decodedSnippet}
          </p>
        )}

        {/* Row 4: Label Dropdown + Scam Badge (same row, spread apart) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Left: Label Dropdown or Status Badge */}
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
                  className="select-neumorphic text-xs px-2.5 py-1 rounded-full cursor-pointer min-h-tap"
                  style={{
                    background: pendingLabel ? 'rgba(234, 179, 8, 0.1)' : labelStyle.bg,
                    color: labelStyle.text,
                  }}
                >
                  {combinedLabels.map(label => (
                    <option key={label.label_id} value={label.label_name}>
                      {label.label_name}
                    </option>
                  ))}
                </select>
                {pendingLabel && (
                  <span className="text-yellow-400 text-xs">●</span>
                )}
              </div>
            )}

            {/* Status Badges */}
            {email.status === 'fetched' && (
              <span className="badge-status bg-yellow-500/15 text-yellow-400 text-[10px] md:text-xs">
                ⏳ Analyzing...
              </span>
            )}
            {email.status === 'failed' && (
              <span className="badge-status bg-red-500/15 text-red-400 text-[10px] md:text-xs">
                ⚠ Failed
              </span>
            )}
          </div>

          {/* Right: Scam Badge */}
          {showScamBadge && email.scam_score > 0 && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <ScamBadge
                score={email.scam_score}
                reason={email.scam_reason || ''}
                indicators={indicators}
              />
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content (Full Email Snippet) */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-white/5">
          <p className="text-sm text-lavender-400 whitespace-pre-wrap leading-relaxed">
            {decodedSnippet || 'No preview available'}
          </p>
        </div>
      )}

      {/* Custom Actions (e.g., delete, move) */}
      {actions && (
        <div className="px-5 pb-4 flex gap-2 border-t border-white/5 pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}

export default EmailCard;
