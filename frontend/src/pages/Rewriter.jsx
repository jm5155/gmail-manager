/**
 * Rewriter.jsx — AI Email Rewriter Page (Phase 8)
 * Two-column layout: Original (textarea) → Rewritten (readonly)
 * Preset command buttons + custom instruction field.
 * Copy to clipboard, provider indicator.
 */

import React, { useState } from 'react';
import { useToast } from '../components/ToastNotification';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Preset rewrite commands
const COMMANDS = [
  { label: '💼 Make Professional', instruction: 'Make this email professional and formal' },
  { label: '✂️ Shorten to 3 Sentences', instruction: 'Shorten this email to exactly 3 sentences while keeping the core message' },
  { label: '😊 Make Friendly', instruction: 'Rewrite this email in a warm, friendly tone' },
  { label: '✏️ Fix Grammar', instruction: 'Fix all grammar and spelling mistakes in this email' },
  { label: '🌐 Translate to English', instruction: 'Translate this email to English' },
];

function Rewriter() {
  const toast = useToast();

  const [originalText, setOriginalText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [activeCommand, setActiveCommand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [providerUsed, setProviderUsed] = useState('');
  const [charCounts, setCharCounts] = useState({ original: 0, rewritten: 0 });

  // Handle command button click — clears custom instruction
  function handleCommandClick(cmd) {
    setActiveCommand(cmd.label);
    setCustomInstruction('');
    doRewrite(cmd.instruction);
  }

  // Handle custom instruction — clears active command
  function handleCustomSubmit() {
    if (!customInstruction.trim()) return;
    setActiveCommand(null);
    doRewrite(customInstruction.trim());
  }

  // Call the /ai/rewrite endpoint
  async function doRewrite(instruction) {
    if (!originalText.trim()) {
      toast.warning('No text to rewrite', 'Paste or type an email in the left panel first.');
      return;
    }

    setLoading(true);
    setRewrittenText('');
    setProviderUsed('');

    try {
      const res = await fetch(`${API_BASE}/ai/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: originalText, instruction }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setRewrittenText(data.rewritten);
        setProviderUsed(data.provider_used || 'Unknown');
        setCharCounts({
          original: data.character_count_original || originalText.length,
          rewritten: data.character_count_rewritten || data.rewritten.length,
        });
        toast.success('Rewrite complete!', `Using ${data.provider_used}`);
      } else {
        toast.error('Rewrite failed', data.error || 'All AI providers exhausted.');
      }
    } catch (err) {
      toast.error('Rewrite failed', 'Could not connect to the backend.');
    } finally {
      setLoading(false);
    }
  }

  // Copy rewritten text to clipboard
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rewrittenText);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  }

  return (
    <div className="h-screen overflow-hidden pl-0 md:pl-[240px]">
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
        <h1 className="text-xl font-bold text-text-primary mb-1">AI Email Rewriter</h1>
        <p className="text-sm text-text-secondary">
          Paste an email and let AI transform it. Works independently of Gmail.
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="flex gap-4 p-6" style={{ height: 'calc(100vh - 90px)' }}>
        {/* LEFT COLUMN — Original */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-text-primary">Original</h2>
            <span className="text-xs text-text-secondary">{originalText.length} / 5000 chars</span>
          </div>

          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value.slice(0, 5000))}
            placeholder="Paste or type your email text here..."
            className="flex-1 p-4 rounded-xl text-sm text-text-primary placeholder-text-secondary outline-none
                       resize-none transition-all duration-200 focus:ring-2 focus:ring-primary"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              minHeight: '200px',
            }}
          />

          {/* Command Buttons */}
          <div className="mt-4">
            <p className="text-xs text-text-secondary mb-2 font-semibold">Quick Commands:</p>
            <div className="flex flex-wrap gap-2">
              {COMMANDS.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => handleCommandClick(cmd)}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200
                             hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
                  style={{
                    background: activeCommand === cmd.label ? 'rgba(37, 99, 235, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                    border: `1px solid ${activeCommand === cmd.label ? 'rgba(37, 99, 235, 0.4)' : '#334155'}`,
                    color: activeCommand === cmd.label ? '#60A5FA' : '#94A3B8',
                  }}
                >
                  {cmd.label}
                </button>
              ))}
            </div>

            {/* Custom Instruction */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                placeholder="Or type your own instruction..."
                value={customInstruction}
                onChange={(e) => {
                  setCustomInstruction(e.target.value);
                  setActiveCommand(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-text-primary placeholder-text-secondary
                           outline-none transition-all duration-200 focus:ring-2 focus:ring-primary"
                style={{ background: '#1E293B', border: '1px solid #334155' }}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={loading || !customInstruction.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                }}
              >
                Rewrite
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px flex-shrink-0" style={{ background: '#1E293B' }}></div>

        {/* RIGHT COLUMN — Rewritten */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-text-primary">Rewritten</h2>
            {rewrittenText && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-text-secondary
                           transition-all duration-200 hover:text-primary hover:bg-surface"
                style={{ border: '1px solid #334155' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </button>
            )}
          </div>

          <div
            className="flex-1 p-4 rounded-xl text-sm overflow-y-auto relative"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              minHeight: '200px',
            }}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-text-secondary text-sm">AI is rewriting...</p>
              </div>
            ) : rewrittenText ? (
              <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{rewrittenText}</p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                <svg className="w-10 h-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                <p className="text-text-secondary text-sm">Rewritten text will appear here</p>
              </div>
            )}
          </div>

          {/* Provider + Char Count */}
          {providerUsed && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-text-secondary">
                Provider: <span className="text-primary font-medium">{providerUsed}</span>
              </span>
              <span className="text-xs text-text-secondary">
                {charCounts.original} → {charCounts.rewritten} chars
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Rewriter;
