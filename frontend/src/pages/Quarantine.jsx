/**
 * Quarantine.jsx — Quarantined Emails Page (Phase 5)
 * Lists quarantined emails with red warning badges.
 * Actions: "Mark Safe" (removes flag) and "Delete" (moves to Gmail trash).
 * Confirmation modal before any delete action.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastNotification';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function Quarantine() {
  const navigate = useNavigate();
  const toast = useToast();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null); // email to confirm delete

  useEffect(() => {
    fetchQuarantined();
  }, []);

  async function fetchQuarantined() {
    try {
      const authRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const authData = await authRes.json();
      if (!authData.logged_in) { navigate('/login'); return; }

      const res = await fetch(`${API_BASE}/quarantine`, { credentials: 'include' });
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (err) {
      console.error('[QUARANTINE] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkSafe(emailId) {
    try {
      const res = await fetch(`${API_BASE}/quarantine/${emailId}/safe`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        setEmails((prev) => prev.filter((e) => e.email_id !== emailId));
        toast.success('Email marked as safe', 'Removed from quarantine.');
      }
    } catch (err) {
      toast.error('Failed to mark as safe', err.message);
    }
  }

  async function handleDelete(emailId) {
    try {
      const res = await fetch(`${API_BASE}/quarantine/${emailId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setEmails((prev) => prev.filter((e) => e.email_id !== emailId));
        toast.success('Email moved to trash', 'Email was not permanently deleted.');
      } else {
        toast.error('Failed to delete email');
      }
    } catch (err) {
      toast.error('Failed to delete email', err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  // Parse scam indicators
  function parseIndicators(str) {
    try { return typeof str === 'string' ? JSON.parse(str) : (str || []); }
    catch { return []; }
  }

  return (
    <div className="h-screen overflow-hidden pl-0 md:pl-[240px]">
      {/* Header */}
      <div className="px-6 py-4 pt-16 md:pt-4" style={{ borderBottom: '1px solid #1E293B' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Quarantine</h1>
            <p className="text-sm text-text-secondary">
              {emails.length} email{emails.length !== 1 ? 's' : ''} flagged as suspicious
            </p>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="p-6 overflow-y-auto" style={{ height: 'calc(100vh - 100px)' }}>
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-3 border-danger border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
            <p className="text-text-secondary">Loading quarantined emails...</p>
          </div>
        )}

        {!loading && emails.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-5xl opacity-30">✅</div>
            <p className="text-text-secondary text-lg font-medium">Quarantine is empty</p>
            <p className="text-text-secondary text-sm">No suspicious emails detected. You're safe!</p>
          </div>
        )}

        <div className="space-y-3">
          {emails.map((email) => {
            const indicators = parseIndicators(email.scam_indicators);
            return (
              <div
                key={email.email_id}
                className="rounded-xl p-5"
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {/* Red Warning Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    ⚠️ Quarantined
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}>
                    Score: {email.scam_score}
                  </span>
                </div>

                {/* Email Info */}
                <h3 className="text-sm font-semibold text-text-primary mb-1">{email.subject || '(No Subject)'}</h3>
                <p className="text-xs text-text-secondary mb-2">From: {email.sender}</p>

                {/* Threat Reason */}
                {email.scam_reason && (
                  <p className="text-xs text-text-secondary mb-2 p-2 rounded-lg"
                     style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                    💡 {email.scam_reason}
                  </p>
                )}

                {/* Indicators */}
                {indicators.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-text-secondary font-semibold mb-1">Suspicious indicators:</p>
                    <ul className="space-y-0.5">
                      {indicators.map((ind, idx) => (
                        <li key={idx} className="text-xs text-text-secondary flex items-start gap-1.5">
                          <span className="text-danger mt-0.5">•</span> {ind}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleMarkSafe(email.email_id)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-success transition-all duration-200
                               hover:bg-surface"
                    style={{ border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.08)' }}
                  >
                    ✓ Mark Safe
                  </button>
                  <button
                    onClick={() => setDeleteTarget(email)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-danger transition-all duration-200
                               hover:bg-surface"
                    style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Move to Trash?"
        message={`This will move "${deleteTarget?.subject || 'this email'}" to Gmail Trash. It will NOT be permanently deleted.`}
        onConfirm={() => handleDelete(deleteTarget?.email_id)}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Move to Trash"
        danger={true}
      />
    </div>
  );
}

export default Quarantine;
