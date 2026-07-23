/**
 * Settings.jsx — Settings Page (Phase 9 + 10)
 * Manages AI provider API keys and app configuration.
 * Shows provider status (connected/disconnected) with visual indicators.
 * Dark mode toggle for future use.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastNotification';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// API key field definitions
const API_FIELDS = [
  {
    key: 'GROQ_API_KEY',
    label: 'Groq API Key',
    placeholder: 'gsk_...',
    description: 'Primary AI provider — Groq LLaMA 3 (llama3-8b-8192)',
    role: 'Primary',
    icon: '🟢',
  },
  {
    key: 'GEMINI_API_KEY',
    label: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    description: 'Secondary AI provider — Google Gemini Flash',
    role: 'Secondary',
    icon: '🔵',
  },
  {
    key: 'COHERE_API_KEY',
    label: 'Cohere API Key',
    placeholder: 'R0Uw...',
    description: 'Tertiary AI provider — Cohere Command-R',
    role: 'Tertiary',
    icon: '🟡',
  },
  {
    key: 'NVIDIA_API_KEY',
    label: 'NVIDIA API Key',
    placeholder: 'nvapi-...',
    description: 'Reserved provider — NVIDIA NIM (inactive, for future use)',
    role: 'Inactive',
    icon: '⚪',
  },
  {
    key: 'GOOGLE_SAFE_BROWSING_KEY',
    label: 'Safe Browsing API Key',
    placeholder: 'AIzaSy...',
    description: 'Google Safe Browsing — scans URLs for malware/phishing',
    role: 'Security',
    icon: '🛡️',
  },
];

function Settings() {
  const navigate = useNavigate();
  const toast = useToast();

  const [providerStatus, setProviderStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  
  // Custom Labels State
  const [customLabels, setCustomLabels] = useState([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [labelLoading, setLabelLoading] = useState(false);

  // Delete Mode State (Item 2)
  const [deleteMode, setDeleteMode] = useState('trash');
  const [showDeleteInfo, setShowDeleteInfo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const authRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const authData = await authRes.json();
      if (!authData.logged_in) { navigate('/login'); return; }
      setUserEmail(authData.email || '');

      // Fetch AI provider status
      const aiRes = await fetch(`${API_BASE}/ai/status`, { credentials: 'include' });
      const aiData = await aiRes.json();
      setProviderStatus(aiData.providers || {});

      // Fetch custom labels
      const labelRes = await fetch(`${API_BASE}/settings/labels`, { credentials: 'include' });
      if (labelRes.ok) {
        const labelData = await labelRes.json();
        setCustomLabels(labelData.labels || []);
      }

      // Fetch delete mode (Item 2)
      const dmRes = await fetch(`${API_BASE}/settings/delete-mode`, { credentials: 'include' });
      if (dmRes.ok) {
        const dmData = await dmRes.json();
        setDeleteMode(dmData.delete_mode || 'trash');
      }
    } catch (err) {
      console.error('[SETTINGS] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      toast.success('Logged out', 'Redirecting to login...');
      setTimeout(() => navigate('/login'), 500);
    } catch (err) {
      toast.error('Logout failed', err.message);
    }
  }

  async function handleAddLabel() {
    if (!newLabelName.trim()) return;
    setLabelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName.trim() }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add label');
      
      toast.success('Label added', `${newLabelName} was added successfully.`);
      setNewLabelName('');
      
      // Refresh labels
      const labelRes = await fetch(`${API_BASE}/settings/labels`, { credentials: 'include' });
      if (labelRes.ok) {
        const labelData = await labelRes.json();
        setCustomLabels(labelData.labels || []);
      }
    } catch (err) {
      toast.error('Error adding label', err.message);
    } finally {
      setLabelLoading(false);
    }
  }

  async function handleDeleteLabel(label) {
    if (!window.confirm(`Are you sure you want to delete the "${label.label_name}" label?`)) return;
    try {
      const res = await fetch(`${API_BASE}/labels/${label.label_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete label');
      
      toast.success('Label deleted', `${label.label_name} was removed.`);
      setCustomLabels(prev => prev.filter(l => l.label_id !== label.label_id));
    } catch (err) {
      toast.error('Error deleting label', err.message);
    }
  }

  async function handleResetDatabase() {
    if (!window.confirm('WARNING: This will wipe all analyzed emails, scan cursors, and failure queues locally. Are you absolutely sure?')) return;
    try {
      const res = await fetch(`${API_BASE}/settings/reset-database`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clean database');
      
      toast.success('Database Reset Successful', data.message);
    } catch (err) {
      toast.error('Error resetting database', err.message);
    }
  }

  function isConfigured(providerKey) {
    const keyMap = {
      'NVIDIA_API_KEY': 'nvidia',
      'GEMINI_API_KEY': 'gemini',
      'COHERE_API_KEY': 'cohere',
      'GROQ_API_KEY': 'groq',
      'GOOGLE_SAFE_BROWSING_KEY': 'safebrowsing',
    };
    const providerName = keyMap[providerKey];
    if (providerName && providerStatus[providerName]) {
      return providerStatus[providerName].configured;
    }
    return false;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center pl-0 md:pl-[240px]">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto pl-0 md:pl-[240px]">
      {/* Header */}
      <div className="px-6 py-4 pt-16 md:pt-4" style={{ borderBottom: '1px solid #1E293B' }}>
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Manage AI providers, security keys, and account settings.
        </p>
      </div>

      <div className="p-4 md:p-6 max-w-3xl space-y-4 md:space-y-6">
        {/* Account Section */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Account
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">{userEmail || 'Connected Google Account'}</p>
              <p className="text-xs text-text-secondary mt-0.5">OAuth 2.0 — Gmail API access granted</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-xs font-medium text-danger transition-all duration-200 hover:bg-surface"
              style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}
            >
              Sign Out
            </button>
          </div>
        </section>

        {/* AI Providers Section */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Cascade Providers
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            Providers are tried in order. If one hits a rate limit, the next one is used automatically.
          </p>

          <div className="space-y-3">
            {API_FIELDS.map((field) => {
              const configured = isConfigured(field.key);
              return (
                <div
                  key={field.key}
                  className="flex items-center justify-between p-3 rounded-lg transition-all duration-200"
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: `1px solid ${configured ? 'rgba(34, 197, 94, 0.2)' : '#334155'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{field.icon}</span>
                    <div>
                      <p className="text-sm text-text-primary font-medium">{field.label}</p>
                      <p className="text-xs text-text-secondary">{field.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: field.role === 'Inactive'
                          ? 'rgba(100, 116, 139, 0.15)'
                          : configured
                            ? 'rgba(34, 197, 94, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        color: field.role === 'Inactive'
                          ? '#64748B'
                          : configured
                            ? '#22C55E'
                            : '#EF4444',
                        border: `1px solid ${field.role === 'Inactive' ? 'rgba(100, 116, 139, 0.2)' : configured ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      }}
                    >
                      {field.role === 'Inactive' ? 'Inactive' : configured ? '● Connected' : '○ Not Set'}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: '#60A5FA',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      {field.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-text-secondary mt-4 p-3 rounded-lg"
             style={{ background: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.12)' }}>
            💡 API keys are configured in <code className="text-primary font-mono text-xs">backend/.env</code>. 
            Restart the backend after making changes.
          </p>
        </section>

        {/* Cascade Info */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            AI Cascade Order
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {['Groq (Primary)', 'Gemini (Secondary)', 'Cohere (Tertiary)'].map((name, idx) => (
              <React.Fragment key={name}>
                <span
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: '#60A5FA',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                  }}
                >
                  {name}
                </span>
                {idx < 2 && (
                  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-3">
            If the primary provider returns a 429 rate-limit error, the system automatically falls back to the next provider.
          </p>
        </section>

        {/* Custom Labels Section */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            Custom Labels
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            Create custom labels that the AI will automatically use when scanning emails. Colors are auto-assigned. You have total freedom to delete any label.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. Project Alpha, Receipts, Bills..."
              value={newLabelName}
              onChange={e => setNewLabelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-text-primary outline-none transition-colors"
              style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155' }}
            />
            <button
              onClick={handleAddLabel}
              disabled={labelLoading || !newLabelName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' }}
            >
              Add Label
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {customLabels.map(label => (
              <div 
                key={label.label_id || label.label_name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold group transition-all"
                style={{ background: label.bg_color, color: label.text_color }}
              >
                <span>{label.label_name}</span>
                <button 
                  onClick={() => handleDeleteLabel(label)}
                  className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                  title="Delete Label"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {customLabels.length === 0 && (
              <p className="text-xs text-text-secondary italic">No custom labels defined.</p>
            )}
          </div>
        </section>

        {/* Email Deletion Behavior (Item 2) */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Email Deletion Behavior
            {/* Info Icon */}
            <div className="relative ml-1">
              <button
                onClick={() => setShowDeleteInfo(prev => !prev)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors"
                style={{
                  background: showDeleteInfo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: showDeleteInfo ? '#FBBF24' : '#94A3B8',
                  border: `1px solid ${showDeleteInfo ? 'rgba(245, 158, 11, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                }}
                title="More info"
              >
                i
              </button>
              {showDeleteInfo && (
                <div
                  className="absolute left-8 top-0 z-50 p-3 rounded-lg text-xs w-72"
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <p className="font-semibold text-text-primary mb-1.5">How does this work?</p>
                  <p className="text-text-secondary mb-2">
                    <strong style={{ color: '#4ADE80' }}>Move to Trash</strong> — Emails are moved to Gmail's trash folder. They can be recovered within 30 days. This is the safe, default option.
                  </p>
                  <p className="text-text-secondary">
                    <strong style={{ color: '#F87171' }}>Permanently Delete</strong> — Emails are permanently removed from your Gmail account. <span style={{ color: '#FBBF24' }}>This cannot be undone.</span>
                  </p>
                </div>
              )}
            </div>
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            Choose what happens when emails are deleted from the quarantine or batch delete.
          </p>

          {/* Toggle Switch */}
          <div className="flex items-center gap-4">
            <button
              onClick={async () => {
                if (deleteMode === 'permanent') {
                  // Switching to trash — no confirmation needed
                  try {
                    await fetch(`${API_BASE}/settings/delete-mode`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ delete_mode: 'trash' }),
                      credentials: 'include',
                    });
                    setDeleteMode('trash');
                    toast.success('Delete mode updated', 'Emails will be moved to trash.');
                  } catch (err) { toast.error('Failed to update', err.message); }
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: deleteMode === 'trash' ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                border: `1px solid ${deleteMode === 'trash' ? 'rgba(34, 197, 94, 0.3)' : '#334155'}`,
                color: deleteMode === 'trash' ? '#4ADE80' : '#94A3B8',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Move to Trash
              {deleteMode === 'trash' && <span className="text-xs opacity-70">(Active)</span>}
            </button>

            <button
              onClick={async () => {
                if (deleteMode === 'trash') {
                  // Switching to permanent — show confirmation
                  const confirmed = window.confirm(
                    'WARNING: Permanently deleted emails CANNOT be recovered.\n\n' +
                    'Are you sure you want to switch to permanent deletion?'
                  );
                  if (!confirmed) return;
                  try {
                    await fetch(`${API_BASE}/settings/delete-mode`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ delete_mode: 'permanent' }),
                      credentials: 'include',
                    });
                    setDeleteMode('permanent');
                    toast.success('Delete mode updated', 'Emails will be permanently deleted. Be careful!');
                  } catch (err) { toast.error('Failed to update', err.message); }
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: deleteMode === 'permanent' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                border: `1px solid ${deleteMode === 'permanent' ? 'rgba(239, 68, 68, 0.3)' : '#334155'}`,
                color: deleteMode === 'permanent' ? '#F87171' : '#94A3B8',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Permanently Delete
              {deleteMode === 'permanent' && <span className="text-xs opacity-70">(Active)</span>}
            </button>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-danger mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Danger Zone
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              Wipe all analyzed emails and pointers. This essentially restarts the bulk fetch functionality from the very top of your inbox.
            </p>
            <button
              onClick={handleResetDatabase}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-all hover:bg-danger"
              style={{ background: 'rgba(239, 68, 68, 0.8)' }}
            >
              Reset Database
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="rounded-lg p-4 md:p-5 w-full" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', maxWidth: '355px' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            About
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'Backend', value: 'FastAPI (port 8000)' },
              { label: 'Frontend', value: 'React + Vite' },
              { label: 'Database', value: 'SQLite3' },
            ].map((item) => (
              <div key={item.label} className="p-2.5 rounded-lg" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <p className="text-xs text-text-secondary">{item.label}</p>
                <p className="text-sm text-text-primary font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
