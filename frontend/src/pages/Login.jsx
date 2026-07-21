/**
 * Login.jsx — Google OAuth Login Page
 * Displays a centered login card with the app branding and a "Sign in with Google" button.
 * On click, triggers the OAuth flow via the backend, then polls /auth/status every 2 seconds.
 * When login is detected, redirects to /inbox.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Backend API base URL
const API_BASE = 'http://localhost:8000';

function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);       // Shows spinner during login
  const [error, setError] = useState('');                   // Error message display
  const [checkingAuth, setCheckingAuth] = useState(true);   // Initial auth check
  const pollingRef = useRef(null);                          // Polling interval reference

  // ---------- CHECK IF ALREADY LOGGED IN ON MOUNT ----------
  useEffect(() => {
    checkExistingAuth();
    // Cleanup polling interval on unmount
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function checkExistingAuth() {
    try {
      const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const data = await res.json();
      if (data.logged_in) {
        // Already authenticated — skip login, go to inbox
        navigate('/inbox');
      }
    } catch (err) {
      console.log('[LOGIN] Backend not reachable yet, showing login page.');
    } finally {
      setCheckingAuth(false);
    }
  }

  // ---------- TRIGGER GOOGLE LOGIN ----------
  async function handleLogin() {
    setIsLoading(true);
    setError('');

    try {
      // Call the backend to get the Google OAuth URL (it also opens the browser)
      const res = await fetch(`${API_BASE}/auth/login`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start login');
      }

      // Start polling /auth/status every 2 seconds to detect successful login
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
          const statusData = await statusRes.json();

          if (statusData.logged_in) {
            // Login successful! Stop polling and navigate to inbox
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsLoading(false);
            navigate('/inbox');
          }
        } catch (err) {
          // Backend temporarily unreachable — keep trying
          console.log('[LOGIN] Polling status failed, retrying...');
        }
      }, 2000);

    } catch (err) {
      setError('Could not connect to the backend. Make sure the server is running on port 8000.');
      setIsLoading(false);
    }
  }

  // ---------- LOADING STATE (checking existing auth) ----------
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="animate-pulse text-text-secondary text-lg">Checking authentication...</div>
      </div>
    );
  }

  // ---------- RENDER LOGIN PAGE ----------
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-dark relative overflow-hidden">

      {/* Background gradient orbs for visual flair */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full opacity-20"
           style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}></div>
      <div className="absolute bottom-[-150px] right-[-150px] w-[400px] h-[400px] rounded-full opacity-15"
           style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-xl p-8 text-center"
             style={{
               background: 'rgba(30, 41, 59, 0.8)',
               backdropFilter: 'blur(20px)',
               border: '1px solid rgba(51, 65, 85, 0.5)',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
             }}>

          {/* App Logo — Gmail-style envelope icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                 style={{
                   background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                   boxShadow: '0 10px 30px -5px rgba(37, 99, 235, 0.4)',
                 }}>
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>

          {/* App Title */}
          <h1 className="text-3xl font-bold text-text-primary mb-2">Gmail Manager</h1>
          <p className="text-text-secondary mb-8 text-sm leading-relaxed">
            AI-powered email management. Smart labeling,<br />scam detection, and intelligent sorting.
          </p>

          {/* Sign in Button */}
          <button
            id="google-login-btn"
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-lg font-semibold text-white text-base
                       transition-all duration-300 ease-out
                       disabled:opacity-60 disabled:cursor-not-allowed
                       hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: isLoading
                ? '#475569'
                : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              boxShadow: isLoading
                ? 'none'
                : '0 4px 15px -3px rgba(37, 99, 235, 0.4)',
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                {/* Loading spinner */}
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Waiting for Google login...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                {/* Google icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity="0.8"/>
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity="0.6"/>
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity="0.4"/>
                </svg>
                Sign in with Google
              </span>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg text-sm text-red-400"
                 style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          {/* Footer info */}
          <p className="mt-6 text-xs text-text-secondary opacity-60">
            Requires Gmail API access · Your data stays on this device
          </p>
        </div>

        {/* Features preview below the card */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: '🏷️', label: 'Auto Labels' },
            { icon: '🛡️', label: 'Scam Shield' },
            { icon: '✨', label: 'AI Rewrite' },
          ].map((feat) => (
            <div key={feat.label}
                 className="rounded-lg py-3 px-2 text-center text-xs text-text-secondary
                            transition-all duration-300 hover:text-text-primary hover:scale-105"
                 style={{
                   background: 'rgba(30, 41, 59, 0.5)',
                   border: '1px solid rgba(51, 65, 85, 0.3)',
                 }}>
              <div className="text-xl mb-1">{feat.icon}</div>
              {feat.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Login;
