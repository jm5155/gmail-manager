/**
 * AnalysisContext.jsx — Global Analysis State (Part 2)
 * Holds bulk analysis progress state at the app level so it persists
 * across tab navigation (component mount/unmount cycles).
 *
 * The SSE connection is stored in a ref to survive re-renders and is
 * only closed when analysis completes or the provider unmounts.
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const AnalysisContext = createContext(null);

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return ctx;
}

export function AnalysisProvider({ children }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [currentEmail, setCurrentEmail] = useState('');

  // Store the reader ref so the SSE stream survives re-renders
  const readerRef = useRef(null);
  const abortRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        try { readerRef.current.cancel(); } catch { /* ignore */ }
      }
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  const startAnalysis = useCallback(async (limit) => {
    if (isAnalyzing) return;

    setIsInitializing(true);
    setIsAnalyzing(true);
    setProgress(0);
    setTotal(0);
    setResults([]);
    setStats(null);
    setCurrentEmail('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Step 1: Fetch-only (fast)
      const fetchResponse = await fetch(`${API_BASE}/emails/fetch-only?limit=${limit}`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
      });

      const fetchReader = fetchResponse.body.getReader();
      readerRef.current = fetchReader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await fetchReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.type === 'initializing') {
                setCurrentEmail(data.message || 'Fetching emails...');
              } else if (data.type === 'progress') {
                setCurrentEmail(`Fetched ${data.current || 0} emails...`);
              } else if (data.type === 'complete') {
                setCurrentEmail(`Fetched ${data.fetched || 0} emails. Starting analysis...`);
              }
            } catch (e) {
              console.error('Failed to parse fetch SSE:', e);
            }
          }
        }
      }

      // Step 2: Label-only (AI analysis)
      const labelResponse = await fetch(`${API_BASE}/emails/label-only?limit=${limit}`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
      });

      const labelReader = labelResponse.body.getReader();
      readerRef.current = labelReader;
      buffer = '';

      while (true) {
        const { done, value } = await labelReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());

              if (data.type === 'initializing') {
                setCurrentEmail(data.message || 'Fetching emails from Gmail...');
              } else if (data.type === 'progress') {
                if (data.total > 0) setIsInitializing(false);
                setProgress(data.progress || data.current || 0);
                setTotal(data.total);
                setCurrentEmail(data.subject || data.email_subject || '');
              } else if (data.type === 'email_done') {
                if (data.total > 0) setIsInitializing(false);
                setProgress(data.progress || data.current || 0);
                setTotal(data.total);
                setCurrentEmail(`Done: ${data.subject || data.email_subject || ''}`);
                setResults((prev) => [...prev, data]);
              } else if (data.type === 'complete') {
                setStats({
                  analyzed: data.analyzed || 0,
                  skipped: data.skipped || 0,
                  failed: data.failed || 0,
                  retried: data.retried || 0,
                });
              }
            } catch { /* skip parse errors */ }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[AnalysisContext] SSE error:', err);
      }
    } finally {
      setIsAnalyzing(false);
      setIsInitializing(false);
      readerRef.current = null;
      abortRef.current = null;
    }
  }, [isAnalyzing]);

  // Allow consumers to acknowledge/clear stats so notifications don't re-fire
  const clearStats = useCallback(() => {
    setStats(null);
  }, []);

  const value = {
    isAnalyzing,
    isInitializing,
    progress,
    total,
    results,
    stats,
    currentEmail,
    startAnalysis,
    clearStats,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export default AnalysisContext;
