/**
 * EmailDetailPanel.jsx — Email Detail Slide-Over Panel (Phase 35)
 * Redesigned with cleaner UI and explicit "Apply to Gmail" button.
 * Shows full email details with manual label override capability.
 * Slide-over from right, explicit apply button, unsaved changes indicator.
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ScamBadge from './ScamBadge';

function EmailDetailPanel({ email, isOpen, onClose, onLabelChange }) {
  const [selectedLabel, setSelectedLabel] = useState(email?.label_name || '');
  const [savedLabel, setSavedLabel] = useState(email?.label_name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [labels, setLabels] = useState([]);
  const API_BASE = 'http://localhost:8000';

  // Fetch available labels
  useEffect(() => {
    fetch(`${API_BASE}/settings/labels`, { credentials: 'include' })
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
    setSelectedLabel(e.target.value); // Local state only, no API call
  };

  const handleApplyToGmail = async () => {
    if (!email || !hasUnsavedChanges) return;

    const originalLabel = savedLabel;

    try {
      setIsUpdating(true);

      const response = await fetch(`${API_BASE}/emails/${email.email_id}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label_name: selectedLabel }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update label');
      }

      // Success: update saved state
      setSavedLabel(selectedLabel);
      toast.success(`Label changed to ${selectedLabel}`);
      
      // Notify parent to refresh email list
      if (onLabelChange) {
        onLabelChange(email.email_id, selectedLabel);
      }

    } catch (error) {
      toast.error(`Failed to update label: ${error.message}`);
      // Keep selectedLabel as-is (don't revert), allow retry
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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-background-secondary border-l border-border-primary overflow-y-auto shadow-2xl">
        {/* Top bar with close and apply button */}
        <div className="sticky top-0 bg-background-secondary border-b border-border-primary p-4 z-10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
          <button
            onClick={handleApplyToGmail}
            disabled={!hasUnsavedChanges || isUpdating}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: hasUnsavedChanges && !isUpdating ? '#2563EB' : '#334155',
              color: '#FFFFFF',
              cursor: hasUnsavedChanges && !isUpdating ? 'pointer' : 'not-allowed',
              opacity: hasUnsavedChanges && !isUpdating ? 1 : 0.5,
            }}
          >
            {isUpdating ? 'Applying...' : 'Apply to Gmail'}
          </button>
        </div>

        {/* Email metadata */}
        <div className="p-6 border-b border-border-primary">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-text-secondary min-w-[60px]">Sender:</span>
              <span className="text-sm text-text-primary flex-1">{email.sender || 'Unknown Sender'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-text-secondary min-w-[60px]">Subject:</span>
              <span className="text-sm text-text-primary flex-1">{email.subject || '(No Subject)'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-text-secondary min-w-[60px]">Date:</span>
              <span className="text-sm text-text-tertiary flex-1">{formatDate(email.analyzed_at || email.date)}</span>
            </div>
          </div>
        </div>

        {/* Label picker with unsaved indicator */}
        <div className="p-6 border-b border-border-primary bg-background-primary">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-text-secondary min-w-[60px]">Label:</span>
            <select
              value={selectedLabel}
              onChange={handleDropdownChange}
              disabled={isUpdating}
              className="flex-1 px-3 py-2 rounded-lg border border-border-primary bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50"
            >
              {labels.map(label => (
                <option key={label.label_id} value={label.label_name}>
                  {label.label_name}
                </option>
              ))}
            </select>
            {hasUnsavedChanges && !isUpdating && (
              <span className="text-xs text-yellow-500 whitespace-nowrap">⚠ Not yet applied</span>
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
            <pre className="whitespace-pre-wrap text-sm text-text-primary font-sans leading-relaxed">
              {email.body}
            </pre>
          ) : email.snippet ? (
            <div>
              <p className="text-sm text-text-tertiary italic mb-2">Full body not available. Showing snippet:</p>
              <p className="text-sm text-text-primary">{email.snippet}</p>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary italic">No content available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailDetailPanel;
