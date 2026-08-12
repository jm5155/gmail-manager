/**
 * EmailDetailPanel.jsx — Email Detail Slide-Over Panel
 * Redesigned for light design system with clean, minimal UI.
 * Shows full email details with manual label override capability.
 * Slide-over from right, explicit apply button, unsaved changes indicator.
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ScamBadge from './ScamBadge';
import { apiGet, apiRequest } from '../lib/api';

function EmailDetailPanel({ email, isOpen, onClose, onLabelChange }) {
  const [selectedLabel, setSelectedLabel] = useState(email?.label_name || '');
  const [savedLabel, setSavedLabel] = useState(email?.label_name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [labels, setLabels] = useState([]);

  // Fetch available labels
  useEffect(() => {
    apiGet('/settings/labels')
      .then(r => r.json())
      .then(d => setLabels(d.labels || []))
      .catch(err => console.error('Failed to fetch labels:', err));
  }, []);

  // Reset state when email changes
  useEffect(() => {
    if (email) {
      const labelName = email.label_name || '';
      setSelectedLabel(labelName);
      setSavedLabel(labelName);
    }
  }, [email]);

  const hasUnsavedChanges = selectedLabel !== savedLabel;

  const handleDropdownChange = (e) => {
    setSelectedLabel(e.target.value);
  };

  const handleApplyToGmail = async () => {
    if (!email || !hasUnsavedChanges) return;

    try {
      setIsUpdating(true);

      const response = await apiRequest(`/emails/${email.email_id}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_name: selectedLabel }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update label');
      }

      setSavedLabel(selectedLabel);
      toast.success(`Label changed to ${selectedLabel}`);
      
      if (onLabelChange) {
        onLabelChange(email.email_id, selectedLabel);
      }

    } catch (error) {
      toast.error(`Failed to update label: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Parse scam indicators
  let indicators = [];
  if (email?.scam_indicators) {
    try {
      indicators = JSON.parse(email.scam_indicators);
    } catch {
      indicators = [];
    }
  }

  if (!isOpen || !email) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div 
        className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto shadow-2xl"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)'
        }}
      >
        {/* Top bar with close and apply button */}
        <div 
          className="sticky top-0 p-4 z-10 flex items-center justify-between"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)'
          }}
        >
          <button
            onClick={onClose}
            className="text-2xl leading-none transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--color-text-secondary)'}
            aria-label="Close"
          >
            ×
          </button>
          <button
            onClick={handleApplyToGmail}
            disabled={!hasUnsavedChanges || isUpdating}
            className="btn-primary"
            style={{
              opacity: hasUnsavedChanges && !isUpdating ? 1 : 0.5,
              cursor: hasUnsavedChanges && !isUpdating ? 'pointer' : 'not-allowed',
            }}
          >
            {isUpdating ? 'Applying...' : 'Apply to Gmail'}
          </button>
        </div>

        {/* Email metadata */}
        <div 
          className="p-6"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="space-y-4">
            <div>
              <h2 
                className="text-xl font-semibold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {email.subject || '(No Subject)'}
              </h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
<svg 
                className="w-4 h-4 mt-0.5 flex-shrink-0" 
                fill="none" 
                stroke="var(--color-text-secondary)" 
                strokeWidth="1.8" 
                viewBox="0 0 24 24"
              >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="flex-1">
<span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>From</span>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{email.sender || 'Unknown Sender'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
<svg 
                className="w-4 h-4 mt-0.5 flex-shrink-0" 
                fill="none" 
                stroke="var(--color-text-secondary)" 
                strokeWidth="1.8" 
                viewBox="0 0 24 24"
              >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="flex-1">
<span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Date</span>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(email.analyzed_at || email.date)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Label picker with unsaved indicator */}
<div 
            className="p-6"
            style={{ 
              backgroundColor: 'var(--color-background)',
              borderBottom: '1px solid var(--color-border)'
            }}
          >
          <div className="flex items-center gap-3 mb-4">
            <svg 
              className="w-4 h-4 flex-shrink-0" 
              fill="none" 
              stroke="var(--color-text-secondary)" 
              strokeWidth="1.8" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Label</span>
            <select
              value={selectedLabel}
              onChange={handleDropdownChange}
              disabled={isUpdating}
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                '--tw-ring-color': 'var(--color-primary)',
              }}
            >
              {labels.map(label => (
                <option key={label.label_id} value={label.label_name}>
                  {label.label_name}
                </option>
              ))}
            </select>
            {hasUnsavedChanges && !isUpdating && (
              <span 
                className="text-xs whitespace-nowrap font-medium"
                style={{ color: 'var(--color-warning)' }}
              >
                ⚠ Not applied
              </span>
            )}
          </div>

          {email.scam_score > 0 && (
            <div className="mt-4">
              <ScamBadge
                score={email.scam_score}
                reason={email.scam_reason || ''}
                indicators={indicators}
              />
            </div>
          )}
        </div>

        {/* Email body */}
        <div className="p-6">
          {email.body ? (
            <pre 
              className="whitespace-pre-wrap text-sm font-sans"
              style={{ 
                color: 'var(--color-text-primary)',
                lineHeight: '1.7'
              }}
            >
              {email.body}
            </pre>
          ) : email.snippet ? (
            <div>
              <p 
                className="text-sm italic mb-2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Full body not available. Showing snippet:
              </p>
              <p 
                className="text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {email.snippet}
              </p>
            </div>
          ) : (
            <p 
              className="text-sm italic"
              style={{ color: 'var(--color-text-muted)' }}
            >
              No content available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailDetailPanel;
