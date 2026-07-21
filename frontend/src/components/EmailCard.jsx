/**
 * EmailCard.jsx — Email List Card Component (Phase 9)
 * Reusable card for displaying email in Inbox and Scam Alerts.
 * Shows sender avatar, name, subject, date, label chip, and scam badge.
 * Click to expand and show email snippet.
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ScamBadge from './ScamBadge';

// Default fallback label style
const DEFAULT_LABEL_STYLE = { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8' };

// Deterministic avatar colors
const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#EA580C', '#D97706', '#16A34A', '#0891B2',
];

function EmailCard({ email, showScamBadge = true, actions = null, onLabelUpdate = null, onLabelChange = null, pendingLabel = null, availableLabels = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);
  const API_BASE = 'http://localhost:8000';

  // Get the label display name from new API field
  const labelName = email.label_name || email.label || 'Uncategorized';

  // Get sender initials
  const senderName = email.sender?.split('<')[0]?.trim()?.replace(/"/g, '') || 'Unknown';
  const parts = senderName.split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : senderName[0]?.toUpperCase() || '?';

  // Deterministic color from sender name
  let hash = 0;
  for (let i = 0; i < senderName.length; i++) {
    hash = senderName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const avatarColor = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  }

  // Label chip colors — prefer API-provided colors, fall back to available labels lookup
  let labelStyle = DEFAULT_LABEL_STYLE;
  if (email.bg_color && email.text_color) {
    // Use colors directly from the API response (joined from custom_labels table)
    labelStyle = { bg: `${email.bg_color}26`, text: email.bg_color };
  } else {
    // Fall back to looking up from fetched labels list
    const match = availableLabels.find(l => l.label_name === labelName);
    if (match) {
      labelStyle = { bg: `${match.bg_color}26`, text: match.bg_color };
    }
  }

  // Build combined label list for override dropdown
  const allLabelNames = availableLabels.map(l => l.label_name);

  // Parse scam indicators
  let indicators = [];
  if (email.scam_indicators) {
    try { indicators = typeof email.scam_indicators === 'string' ? JSON.parse(email.scam_indicators) : email.scam_indicators; }
    catch { indicators = []; }
  }

  return (
    <div
      className="rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        background: expanded ? 'rgba(30, 41, 59, 0.9)' : 'rgba(30, 41, 59, 0.5)',
        border: `1px solid ${expanded ? 'rgba(37, 99, 235, 0.3)' : 'rgba(51, 65, 85, 0.3)'}`,
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Main Row */}
      <div className="flex items-center gap-4 p-4">
        {/* Sender Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
          style={{ background: avatarColor }}
        >
          {initials}
        </div>

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-primary truncate">{senderName}</span>
            <span className="text-xs text-text-secondary flex-shrink-0">{formatDate(email.analyzed_at || email.date)}</span>
          </div>
          <p className="text-sm text-text-primary truncate mt-0.5">
            {email.subject || '(No Subject)'}
          </p>
          {!expanded && (
            <p className="text-xs text-text-secondary truncate mt-0.5">{email.snippet || ''}</p>
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
              className="text-xs px-2 py-1 rounded border cursor-pointer"
              style={{
                background: pendingLabel ? 'rgba(234, 179, 8, 0.1)' : labelStyle.bg,
                color: labelStyle.text,
                borderColor: pendingLabel ? '#EAB308' : 'rgba(51, 65, 85, 0.3)',
                borderWidth: '1px',
              }}
            >
              {availableLabels.map(label => (
                <option key={label.label_id} value={label.label_name}>
                  {label.label_name}
                </option>
              ))}
            </select>
            {pendingLabel && (
              <span className="text-yellow-500 text-xs">●</span>
            )}
          </div>
        )}

        {/* Status Badges */}
        {email.status === 'fetched' && (
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
            ⏳ Analyzing...
          </span>
        )}
        {email.status === 'failed' && (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
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

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-14 pl-0.5" style={{ borderTop: '1px solid rgba(51, 65, 85, 0.3)', paddingTop: '12px' }}>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mb-4">
              {email.snippet || email.body || 'No preview available.'}
            </p>

            <div className="flex items-center gap-4 mt-2 mb-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-text-secondary font-medium">Label:</span>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: labelStyle.bg, color: labelStyle.text }}
              >
                {labelName}
              </span>
            </div>

            {/* Action buttons if provided */}
            {actions && (
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailCard;
