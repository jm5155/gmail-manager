/**
 * ScamAlerts.jsx — Scam Alerts Page (Phase 6)
 * Lists all emails with scam_score > 30, sorted by score descending.
 * Filter bar: All / Moderate / High / Danger
 * Re-analyze button per email.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailCard from '../components/EmailCard';
import ScamBadge from '../components/ScamBadge';
import { useToast } from '../components/ToastNotification';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const RISK_FILTERS = [
  { label: 'All Alerts', value: 'all', minScore: 30 },
  { label: 'Moderate', value: 'moderate', minScore: 31, maxScore: 60 },
  { label: 'High Risk', value: 'high', minScore: 61, maxScore: 80 },
  { label: 'Danger', value: 'danger', minScore: 81, maxScore: 100 },
];

function ScamAlerts() {
  const navigate = useNavigate();
  const toast = useToast();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [reanalyzing, setReanalyzing] = useState({});

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const authRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const authData = await authRes.json();
      if (!authData.logged_in) { navigate('/login'); return; }

      const res = await fetch(`${API_BASE}/scam/alerts?min_score=30`, { credentials: 'include' });
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (err) {
      console.error('[SCAM] Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReanalyze(emailId) {
    setReanalyzing((prev) => ({ ...prev, [emailId]: true }));
    try {
      const res = await fetch(`${API_BASE}/scam/reanalyze/${emailId}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();

      if (res.ok) {
        // Update the email in the list with new score
        setEmails((prev) =>
          prev.map((e) =>
            e.email_id === emailId
              ? { ...e, scam_score: data.scam_score, scam_reason: data.reason, scam_indicators: JSON.stringify(data.indicators) }
              : e
          )
        );
        toast.success('Re-analysis complete', `New scam score: ${data.scam_score} (via ${data.provider_used})`);
      } else {
        toast.error('Re-analysis failed', data.error || 'Unknown error');
      }
    } catch (err) {
      toast.error('Re-analysis failed', err.message);
    } finally {
      setReanalyzing((prev) => ({ ...prev, [emailId]: false }));
    }
  }

  // Apply client-side risk filter
  const filteredEmails = emails.filter((email) => {
    const filter = RISK_FILTERS.find((f) => f.value === activeFilter);
    if (!filter || activeFilter === 'all') return true;
    if (filter.maxScore) return email.scam_score >= filter.minScore && email.scam_score <= filter.maxScore;
    return email.scam_score >= filter.minScore;
  });

  // Count per risk level
  const counts = {
    all: emails.length,
    moderate: emails.filter((e) => e.scam_score >= 31 && e.scam_score <= 60).length,
    high: emails.filter((e) => e.scam_score >= 61 && e.scam_score <= 80).length,
    danger: emails.filter((e) => e.scam_score >= 81).length,
  };

  return (
    <div className="h-screen overflow-hidden pl-0 md:pl-[240px]">
      {/* Header */}
      <div className="px-6 py-4 pt-16 md:pt-4" style={{ borderBottom: '1px solid #1E293B' }}>
        <h1 className="text-xl font-bold text-text-primary mb-1">Scam Alerts</h1>
        <p className="text-sm text-text-secondary">
          Emails flagged by AI with elevated scam probability scores.
        </p>

        {/* Risk Level Filter Tabs */}
        <div className="flex gap-2 mt-4">
          {RISK_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 min-w-[85px] flex items-center justify-center gap-1"
              style={{
                background: activeFilter === filter.value ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                color: activeFilter === filter.value ? '#60A5FA' : '#94A3B8',
                border: `1px solid ${activeFilter === filter.value ? 'rgba(37, 99, 235, 0.3)' : '#334155'}`,
              }}
            >
              {filter.label}
              <span className="ml-1.5 text-xs opacity-70">({counts[filter.value]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="px-3 py-6 md:px-6 overflow-y-auto" style={{ height: 'calc(100vh - 160px)' }}>
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
            <p className="text-text-secondary">Loading scam alerts...</p>
          </div>
        )}

        {!loading && filteredEmails.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-5xl opacity-30">🛡️</div>
            <p className="text-text-secondary">
              {emails.length === 0 ? 'No scam alerts found. Your inbox looks clean!' : 'No emails match this risk level.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filteredEmails.map((email) => (
            <EmailCard
              key={email.email_id}
              email={email}
              showScamBadge={true}
              actions={
                <button
                  onClick={() => handleReanalyze(email.email_id)}
                  disabled={reanalyzing[email.email_id]}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary
                             transition-all duration-200 hover:text-primary hover:bg-surface
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ border: '1px solid #334155' }}
                >
                  {reanalyzing[email.email_id] ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Re-analyzing...
                    </span>
                  ) : '🔄 Re-analyze'}
                </button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScamAlerts;
