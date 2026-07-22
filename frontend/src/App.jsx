/**
 * App.jsx — Root React Component (Phase 9)
 * Handles top-level routing between all pages.
 * Includes Sidebar layout for authenticated pages.
 * Smooth fade transitions between routes.
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import ScamAlerts from './pages/ScamAlerts';
import Quarantine from './pages/Quarantine';
import Rewriter from './pages/Rewriter';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/ToastNotification';

// API Base URL - reads from environment variable or defaults to localhost
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Pages that should show the sidebar (authenticated pages)
const SIDEBAR_ROUTES = ['/inbox', '/scam-alerts', '/quarantine', '/rewriter', '/settings'];

function AppContent() {
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showSidebar = SIDEBAR_ROUTES.some((r) => location.pathname.startsWith(r));

  // Fetch user email on mount (for sidebar display)
  useEffect(() => {
    if (showSidebar) {
      fetchUserEmail();
    }
  }, [showSidebar]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function fetchUserEmail() {
    try {
      const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const data = await res.json();
      if (data.logged_in) {
        setUserEmail(data.email || 'user@gmail.com');
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-bg-dark font-inter">
      {/* Mobile Hamburger Button - only visible on mobile when sidebar pages are active */}
      {showSidebar && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-40 p-2.5 rounded-lg bg-bg-card border border-border-subtle md:hidden hover:bg-bg-hover transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar — responsive behavior */}
      {showSidebar && (
        <Sidebar
          userEmail={userEmail}
          mobileMenuOpen={mobileMenuOpen}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Overlay - dark backdrop when drawer is open */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Page Content with fade transition - responsive padding */}
      <div
        key={location.pathname}
        className="md:pl-[240px]"
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <Routes>
          {/* Auth routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Main app routes */}
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/scam-alerts" element={<ScamAlerts />} />
          <Route path="/quarantine" element={<Quarantine />} />
          <Route path="/rewriter" element={<Rewriter />} />
          <Route path="/settings" element={<Settings />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Global animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
