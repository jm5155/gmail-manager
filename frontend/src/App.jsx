/**
 * App.jsx — Root React Component (Phase 9)
 * Handles top-level routing between all pages.
 * Includes Sidebar layout for authenticated pages.
 * Smooth fade transitions between routes.
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import ScamAlerts from './pages/ScamAlerts';
import Quarantine from './pages/Quarantine';
import Rewriter from './pages/Rewriter';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import AnimatedBackground from './components/AnimatedBackground';
import ToastProvider from './components/ToastNotification';
import { ThemeProvider } from './context/ThemeContext';
import { apiGet, setAuthToken, getAuthToken } from './lib/api';

// API Base URL - reads from environment variable or defaults to localhost
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Pages that should show the sidebar (authenticated pages)
const SIDEBAR_ROUTES = ['/inbox', '/scam-alerts', '/quarantine', '/rewriter', '/settings'];

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showSidebar = SIDEBAR_ROUTES.some((r) => location.pathname.startsWith(r));

  // Extract JWT token from URL parameters after OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    if (token) {
      console.log('[AUTH] JWT token received from OAuth callback');
      setAuthToken(token);
      
      // Remove token from URL for security
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Fetch user info with new token
      fetchUserEmail();
    }
  }, [location.search]);

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
      const res = await apiGet('/auth/status');
      const data = await res.json();
      if (data.logged_in) {
        setUserEmail(data.email || 'user@gmail.com');
      } else {
        setUserEmail('');
      }
    } catch (error) {
      console.error('[AUTH] Failed to fetch user email:', error);
      setUserEmail('');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Animated Background - Particles & Gradients */}
      <AnimatedBackground />

      {/* Mobile Menu Button */}
      {showSidebar && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-lg md:hidden transition-colors"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-flat-sm)'
          }}
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
               style={{ color: 'var(--color-text-primary)' }}>
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

      {/* Page Content with fade transition */}
      <div
        key={location.pathname}
        className={showSidebar ? 'md:ml-[240px]' : ''}
        style={{
          animation: 'fadeIn 0.2s ease-out',
          minHeight: '100vh'
        }}
      >
        <Routes>
          {/* Landing page - public homepage */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Auth routes */}
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
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
