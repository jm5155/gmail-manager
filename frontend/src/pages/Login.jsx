/**
 * Login.jsx — Google OAuth Login Page
 * Modern Minimalism + Soft Neumorphism + Premium SaaS
 * Light mode with subtle depth and clean typography
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // DEBUG: Log API_BASE on component mount
  useEffect(() => {
    console.log('[LOGIN DEBUG] API_BASE:', API_BASE);
    console.log('[LOGIN DEBUG] VITE_API_BASE env var:', import.meta.env.VITE_API_BASE);
  }, []);

  // Check if already logged in on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);

  async function checkExistingAuth() {
    try {
      const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
      const data = await res.json();
      if (data.logged_in) {
        navigate('/inbox');
      }
    } catch (err) {
      console.log('[LOGIN] Backend not reachable yet, showing login page.');
    } finally {
      setCheckingAuth(false);
    }
  }

  // Trigger Google login
  async function handleLogin() {
    console.log('[LOGIN DEBUG] handleLogin called');
    console.log('[LOGIN DEBUG] API_BASE:', API_BASE);
    
    setIsLoading(true);
    setError('');

    try {
      console.log('[LOGIN DEBUG] Fetching auth URL from:', `${API_BASE}/auth/login`);
      
      const res = await fetch(`${API_BASE}/auth/login`, { credentials: 'include' });
      console.log('[LOGIN DEBUG] Response status:', res.status);
      
      const data = await res.json();
      console.log('[LOGIN DEBUG] Response data:', data);

      if (!res.ok) {
        console.error('[LOGIN DEBUG] Response not OK:', data);
        setError(data.error || 'Failed to initiate login. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('[LOGIN DEBUG] Opening popup with URL:', data.auth_url);

      // Open Google OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        data.auth_url,
        'GoogleAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      console.log('[LOGIN DEBUG] Popup opened:', authWindow ? 'Success' : 'Failed');

      if (!authWindow) {
        console.error('[LOGIN DEBUG] Popup blocked by browser');
        setError('Popup blocked. Please allow popups for this site and try again.');
        setIsLoading(false);
        return;
      }

      // Poll for auth completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
          const statusData = await statusRes.json();

          if (statusData.logged_in) {
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            navigate('/inbox');
          }
        } catch (err) {
          console.log('[LOGIN] Polling error:', err);
        }
      }, 2000);

      // Stop polling if popup closed
      const popupCheck = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(popupCheck);
          clearInterval(pollInterval);
          setIsLoading(false);
        }
      }, 500);

    } catch (err) {
      console.error('[LOGIN] Error:', err);
      setError('Unable to reach authentication server. Please try again.');
      setIsLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-background)' }}>
        <div className="w-8 h-8 border-3 rounded-full animate-spin"
             style={{ 
               borderColor: 'var(--color-primary)',
               borderTopColor: 'transparent'
             }}>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'var(--color-background)' }}>

      {/* Login Card - Soft Neumorphic Surface */}
      <div className="w-full max-w-md">
        <div className="p-10 text-center"
             style={{
               background: 'var(--color-surface)',
               borderRadius: 'var(--radius-3xl)',
               boxShadow: 'var(--shadow-neumorphic-lg)',
               border: '1px solid var(--color-border)',
             }}>

          {/* App Logo - Envelope icon with neumorphic container */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 flex items-center justify-center"
                 style={{
                   background: 'var(--color-surface)',
                   borderRadius: 'var(--radius-2xl)',
                   boxShadow: 'var(--shadow-neumorphic-sm)',
                 }}>
              <svg className="w-10 h-10" 
                   style={{ color: 'var(--color-primary)' }} 
                   fill="none" 
                   viewBox="0 0 24 24" 
                   stroke="currentColor" 
                   strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>

          {/* App Title */}
          <h1 className="text-3xl font-bold mb-2" 
              style={{ color: 'var(--color-text-primary)' }}>
            Gmail Manager
          </h1>
          
          {/* Subtitle */}
          <p className="mb-8 text-sm leading-relaxed" 
             style={{ color: 'var(--color-text-secondary)' }}>
            AI-powered email management. Smart labeling,<br />
            scam detection, and intelligent sorting.
          </p>

          {/* Sign in Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="btn-primary w-full py-3.5 px-6 flex items-center justify-center gap-2.5"
            style={{
              fontSize: '14px',
              fontWeight: 600,
            }}>
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg text-sm"
                 style={{
                   background: 'var(--color-danger-bg)',
                   color: 'var(--color-danger)',
                   border: '1px solid var(--color-danger-border)',
                 }}>
              {error}
            </div>
          )}

          {/* Trust Badge */}
          <p className="mt-6 text-xs" 
             style={{ color: 'var(--color-text-muted)' }}>
            Secure OAuth 2.0 authentication via Google
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
