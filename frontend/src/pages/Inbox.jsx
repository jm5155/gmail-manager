/**
 * Inbox.jsx — Email Inbox Page (Phase 4 + 7 + 9 + 36)
 * Full-featured inbox with:
 * - "Analyze Emails" button with bulk AI analysis via SSE
 * - Filter bar (sender/domain search, label dropdown, sort dropdown)
 * - Email list with EmailCard components
 * - Inline label dropdowns with batch "Apply to Gmail" (Phase 36)
 * - Live progress bar during analysis (persists via AnalysisContext)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailCard from '../components/EmailCard';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../components/ToastNotification';
import { useAnalysis } from '../context/AnalysisContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'scam_score', label: 'Scam Score' },
  { value: 'label', label: 'By Label' },
];
const LIMIT_OPTIONS = [25, 50, 100];

function Inbox() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAnalyzing, isInitializing, progress, total, stats, currentEmail, startAnalysis, clearStats } = useAnalysis();

  // Email data
  const [emails, setEmails] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableLabels, setAvailableLabels] = useState(['All']);
  const [labelObjects, setLabelObjects] = useState([]);

  // Pending label changes (Phase 36/38/43)
  const [pendingLabelChanges, setPendingLabelChanges] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Filters (Phase 7)
  const [searchQuery, setSearchQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const searchTimerRef = useRef(null);

  // Refs to hold latest filter values for analysis-completion callback
  const searchQueryRef = useRef(searchQuery);
  const labelFilterRef = useRef(labelFilter);
  const sortByRef = useRef(sortBy);
  searchQueryRef.current = searchQuery;
  labelFilterRef.current = labelFilter;
  sortByRef.current = sortBy;

  // Analysis limit (local UI control)
  const [analyzeLimit, setAnalyzeLimit] = useState(50);

  // Batch delete state
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [batchMode, setBatchMode] = useState('label');
  const [batchValue, setBatchValue] = useState('');
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Stats
  const [emailStats, setEmailStats] = useState({ total_analyzed: 0, total_flagged: 0 });

  // No-labels warning (Item 1)
  const [showNoLabelsWarning, setShowNoLabelsWarning] = useState(false);

  // ---------- LOAD DATA ----------
  useEffect(() => {
    verifyAndFetch();
  }, []);

  // Refresh email list when analysis completes — fires exactly once per run
  useEffect(() => {
    if (stats && !isAnalyzing) {
      toast.success(
        `Analysis complete!`,
        `${stats.analyzed} analyzed, ${stats.failed || 0} failed`
      );
      // Use refs so we always read current filter state, not stale closure values
      fetchFilteredEmails(searchQueryRef.current, labelFilterRef.current, sortByRef.current);
      fetchStats();
      // Clear stats so re-mounting Inbox doesn't re-fire the notification
      clearStats();
    }
  }, [stats, isAnalyzing, clearStats]);

  async function verifyAndFetch() {
    try {
      const authRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const authData = await authRes.json();
      if (!authData.logged_in) { navigate('/login'); return; }

      const labelRes = await fetch(`${API_BASE}/settings/labels`, { credentials: 'include' });
      if (labelRes.ok) {
        const labelData = await labelRes.json();
        if (labelData.labels) {
          setAvailableLabels(['All', ...labelData.labels.map(l => l.label_name)]);
          setLabelObjects(labelData.labels);
        }
      }

      await fetchFilteredEmails();
      await fetchStats();
      await fetchPendingCount();
    } catch (err) {
      setError('Could not connect to backend.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingCount() {
    try {
      const res = await fetch(`${API_BASE}/emails/pending-count`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  }

  // ---------- FETCH FILTERED EMAILS (Phase 7) ----------
  const fetchFilteredEmails = useCallback(async (search = '', label = 'All', sort = 'newest') => {
    try {
      const res = await fetch(`${API_BASE}/emails`, { credentials: 'include' });
      const data = await res.json();

      if (res.ok) {
        let filtered = data.emails || [];

        // Client-side search filter
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(e =>
            (e.sender || '').toLowerCase().includes(q) ||
            (e.subject || '').toLowerCase().includes(q)
          );
        }

        // Client-side label filter
        if (label && label !== 'All') {
          filtered = filtered.filter(e => (e.label_name || e.label) === label);
        }

        // Client-side sort
        if (sort === 'scam_score') {
          filtered.sort((a, b) => (b.scam_score || 0) - (a.scam_score || 0));
        } else if (sort === 'label') {
          filtered.sort((a, b) => (a.label_name || '').localeCompare(b.label_name || ''));
        }
        // 'newest' is default from backend (ORDER BY analyzed_at DESC)

        setEmails(filtered);
        setTotalCount(data.count || 0);
      }
    } catch (err) {
      console.error('[INBOX] Filter fetch failed:', err);
    }
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/emails/stats`, { credentials: 'include' });
      const data = await res.json();
      setEmailStats(data);
    } catch { /* ignore */ }
  }

  // ---------- DEBOUNCED SEARCH (Phase 7) ----------
  function handleSearchChange(value) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchFilteredEmails(value, labelFilter, sortBy);
    }, 300);
  }

  function handleLabelChange(label) {
    setLabelFilter(label);
    fetchFilteredEmails(searchQuery, label, sortBy);
  }

  function handleSortChange(sort) {
    setSortBy(sort);
    fetchFilteredEmails(searchQuery, labelFilter, sort);
  }

  // ---------- PENDING LABEL CHANGES (Phase 36/38/39) ----------
  async function handleCardLabelChange(emailId, newLabel) {
    const email = emails.find(e => e.email_id === emailId);
    if (!email) return;

    console.log('Label change triggered:', {
      emailId,
      newLabel,
      currentLabel: email.label_name,
      isDifferent: newLabel !== email.label_name
    });

    // If reverting to original label, remove from pending
    if (newLabel === email.label_name) {
      setPendingLabelChanges(prev => {
        const next = { ...prev };
        delete next[emailId];
        console.log('Removed from pending. New pending map:', next);
        return next;
      });
      return;
    }

    // New pending change - update local state immediately for UI feedback
    setPendingLabelChanges(prev => {
      const next = { ...prev, [emailId]: newLabel };
      console.log('Added to pending. New pending map:', next);
      return next;
    });

    // Update database immediately (but don't push to Gmail yet)
    try {
      const response = await fetch(`${API_BASE}/emails/${emailId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label_name: newLabel }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update label');
      }

      console.log('Label saved to DB, marked as pending (applied_to_gmail=0)');

      // Refresh pending count from DB
      await fetchPendingCount();

      // Update local email list to reflect new label
      setEmails(prev => prev.map(e => 
        e.email_id === emailId 
          ? { ...e, label_name: newLabel, applied_to_gmail: 0 }
          : e
      ));

    } catch (error) {
      console.error('Failed to save label to DB:', error);
      toast(`❌ Failed to save label: ${error.message}`);
      
      // Revert local state on failure
      setPendingLabelChanges(prev => {
        const next = { ...prev };
        delete next[emailId];
        return next;
      });
    }
  }

  async function handleBatchApply() {
    if (pendingCount === 0 || isApplying) return;

    setIsApplying(true);

    try {
      const response = await fetch(`${API_BASE}/emails/apply-all-pending`, {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();

      if (result.applied > 0) {
        toast(`✅ Applied ${result.applied} labels to Gmail`);
      }

      if (result.failed > 0) {
        toast(`⚠️ ${result.failed} emails failed to update`);
      }

      // Clear local pending map
      setPendingLabelChanges({});

      // Refresh pending count from DB
      await fetchPendingCount();

      // Refresh email list
      fetchEmails();

    } catch (error) {
      toast(`❌ Batch apply failed: ${error.message}`);
    } finally {
      setIsApplying(false);
    }
  }

  // ---------- BULK ANALYSIS VIA CONTEXT (Phase 4) ----------
  async function handleAnalyze() {
    // Item 1: Check for labels before starting analysis
    try {
      const labelRes = await fetch(`${API_BASE}/settings/labels`, { credentials: 'include' });
      if (labelRes.ok) {
        const labelData = await labelRes.json();
        if (!labelData.labels || labelData.labels.length === 0) {
          setShowNoLabelsWarning(true);
          return;
        }
      }
    } catch { /* proceed and let server-side guard catch it */ }

    setShowNoLabelsWarning(false);
    startAnalysis(analyzeLimit);
  }

  // ---------- BATCH DELETE (new feature) ----------
  async function handleBatchDelete() {
    if (!batchValue) return;

    const confirmed = window.confirm(
      `This will permanently move all emails ${
        batchMode === 'label'
          ? `labeled "${batchValue}"`
          : `from "${batchValue}"`
      } to Gmail trash. Continue?`
    );
    if (!confirmed) return;

    setBatchDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/emails/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: batchMode, value: batchValue }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          'Batch delete complete',
          `${data.deleted} emails moved to trash.${data.failed > 0 ? ' ' + data.failed + ' failed.' : ''}`
        );
        setShowBatchDelete(false);
        setBatchValue('');
        fetchFilteredEmails(searchQuery, labelFilter, sortBy);
        fetchStats();
      } else {
        toast.error('Batch delete failed', data.error || 'Unknown error');
      }
    } catch (err) {
      toast.error('Batch delete failed', err.message);
    } finally {
      setBatchDeleting(false);
    }
  }

  const handleLabelUpdate = (emailId, newLabel) => {
    setEmails(prev => prev.map(e => 
      (e.email_id || e.id) === emailId ? { ...e, label_name: newLabel } : e
    ));
  };

  // ---------- RENDER ----------
  return (
    <div className="h-screen overflow-hidden pl-0 md:pl-[240px]">
      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%); width: 40%; }
          50%  { width: 60%; }
          100% { transform: translateX(280%); width: 40%; }
        }
      `}</style>
      {/* Page Header */}
      <div className="px-6 py-4 pt-16 md:pt-4" style={{ borderBottom: '1px solid #1E293B' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Inbox</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {emailStats.total_analyzed} analyzed · {emailStats.total_flagged || 0} flagged
            </p>
          </div>

          {/* Analyze Button Group */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={analyzeLimit}
              onChange={(e) => setAnalyzeLimit(Number(e.target.value))}
              disabled={isAnalyzing}
              className="px-3 py-2 rounded-lg text-sm text-text-primary outline-none transition-colors"
              style={{ background: '#1E293B', border: '1px solid #334155' }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} emails</option>
              ))}
            </select>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200
                         hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isAnalyzing ? '#475569' : 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                boxShadow: isAnalyzing ? 'none' : '0 4px 15px -3px rgba(37, 99, 235, 0.4)',
              }}
            >
              {isInitializing && total === 0 ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Initializing...
                </span>
              ) : isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing ({progress}/{total})
                </span>
              ) : (
                '🔍 Analyze Emails'
              )}
            </button>

            {/* Apply to Gmail Button (Phase 36/38/43) */}
            <button
              onClick={handleBatchApply}
              disabled={pendingCount === 0 || isApplying}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200
                         hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (pendingCount > 0 && !isApplying) ? '#2563EB' : '#475569',
                boxShadow: (pendingCount > 0 && !isApplying) ? '0 4px 15px -3px rgba(37, 99, 235, 0.4)' : 'none',
              }}
            >
              {isApplying ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Applying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  📧 Apply to Gmail
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {pendingCount}
                    </span>
                  )}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowBatchDelete(prev => !prev)}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: showBatchDelete ? '#7F1D1D' : '#1E293B',
                border: '1px solid #334155',
                color: showBatchDelete ? '#FCA5A5' : '#94A3B8',
              }}
            >
              🗑 Batch Delete
            </button>
          </div>
        </div>

        {/* Batch Delete Panel */}
        {showBatchDelete && (
          <div className="flex items-center gap-2 mt-2 p-3 rounded-lg"
               style={{ background: '#1E293B', border: '1px solid #334155' }}>
            <span className="text-xs text-text-secondary whitespace-nowrap">Delete by:</span>

            {/* Mode toggle */}
            <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid #334155' }}>
              {['label', 'sender'].map(mode => (
                <button
                  key={mode}
                  onClick={() => { setBatchMode(mode); setBatchValue(''); }}
                  className="px-3 py-1.5 text-xs capitalize transition-colors"
                  style={{
                    background: batchMode === mode ? '#2563EB' : 'transparent',
                    color: batchMode === mode ? '#fff' : '#94A3B8',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Value input */}
            {batchMode === 'label' ? (
              <select
                value={batchValue}
                onChange={e => setBatchValue(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-text-primary outline-none"
                style={{ background: '#0F172A', border: '1px solid #334155' }}
              >
                <option value="">Select label...</option>
                {availableLabels.filter(l => l !== 'All').map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Sender name or email..."
                value={batchValue}
                onChange={e => setBatchValue(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm text-text-primary outline-none"
                style={{ background: '#0F172A', border: '1px solid #334155' }}
              />
            )}

            {/* Delete button */}
            <button
              onClick={handleBatchDelete}
              disabled={!batchValue || batchDeleting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#DC2626' }}
            >
              {batchDeleting ? 'Deleting...' : 'Delete All Matching'}
            </button>

            {/* Cancel */}
            <button
              onClick={() => { setShowBatchDelete(false); setBatchValue(''); }}
              className="text-text-secondary hover:text-text-primary text-lg leading-none"
            >×</button>
          </div>
        )}

        {/* No Labels Warning Banner (Item 1) */}
        {showNoLabelsWarning && (
          <div
            className="flex items-center gap-3 mt-3 p-4 rounded-xl animate-pulse-once"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#FBBF24' }}>No labels found</p>
              <p className="text-xs text-text-secondary mt-0.5">
                You must create at least one label before running analysis. The AI needs labels to classify your emails.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
            >
              Go to Settings
            </button>
            <button
              onClick={() => setShowNoLabelsWarning(false)}
              className="text-text-secondary hover:text-text-primary text-lg leading-none flex-shrink-0 ml-1"
            >×</button>
          </div>
        )}

        {/* Analysis Progress Bar */}
        {(isAnalyzing || isInitializing) && (
          <div className="mb-4">
            {isInitializing && total === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: '6px', background: '#1E293B' }}
                >
                  {/* Indeterminate pulsing bar */}
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: '40%',
                      background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
                      animation: 'indeterminate 1.4s ease-in-out infinite',
                    }}
                  />
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap">
                  Initializing...
                </span>
              </div>
            ) : (
              <ProgressBar current={progress} total={total} />
            )}
            {currentEmail && (
              <p className="text-xs text-text-secondary mt-1.5 truncate">{currentEmail}</p>
            )}
          </div>
        )}

        {/* Filter Bar (Phase 7) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Filter by sender or domain..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm text-text-primary placeholder-text-secondary outline-none
                         transition-all duration-200 focus:ring-2 focus:ring-primary"
              style={{ background: '#1E293B', border: '1px solid #334155' }}
            />
          </div>

          {/* Label Filter */}
          <select
            value={labelFilter}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-text-primary outline-none transition-colors cursor-pointer"
            style={{ background: '#1E293B', border: '1px solid #334155' }}
          >
            {availableLabels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-text-primary outline-none transition-colors cursor-pointer"
            style={{ background: '#1E293B', border: '1px solid #334155' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Email List */}
      <div className="p-6 overflow-y-auto" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
            <p className="text-text-secondary">Loading emails...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-4 rounded-xl text-danger text-sm"
               style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && emails.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-5xl opacity-30">📭</div>
            <p className="text-text-secondary text-center">
              {searchQuery || labelFilter !== 'All'
                ? 'No emails match your filters.'
                : 'No analyzed emails yet. Click "Analyze Emails" to get started!'}
            </p>
            <p className="text-text-secondary text-xs">
              Showing {emails.length} of {totalCount} emails
            </p>
          </div>
        )}

        {/* Result Count */}
        {!loading && emails.length > 0 && (
          <p className="text-xs text-text-secondary mb-3">
            Showing {emails.length} of {totalCount} emails
          </p>
        )}

        {/* Email Cards */}
        {!loading && !error && (
          <div className="space-y-2">
            {emails.map((email) => (
              <EmailCard
                key={email.email_id}
                email={email}
                showScamBadge={true}
                onLabelUpdate={handleLabelUpdate}
                onLabelChange={handleCardLabelChange}
                pendingLabel={pendingLabelChanges[email.email_id]}
                availableLabels={labelObjects}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Inbox;
