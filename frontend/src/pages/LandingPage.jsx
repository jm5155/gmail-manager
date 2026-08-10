/**
 * LandingPage.jsx — Complete Professional Landing Page
 * Based on exact specifications from GMAIL MANAGER Website Content Structure
 * 
 * Sections:
 * 1. Sticky Header/Navbar
 * 2. Hero Section with badge, headline, CTAs
 * 3. Stats Strip (4 metrics)
 * 4. Features Section (7 cards)
 * 5. AI Cascade Provider Status
 * 6. Architecture / How It Works
 * 7. Security Section
 * 8. Final CTA Section
 * 9. Footer
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // Sticky navbar scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: '🏷️',
      title: 'Auto Labels',
      description: 'AI analyzes every email and applies colored Gmail labels — Work, Finance, Newsletter, and more — automatically.',
    },
    {
      icon: '🛡️',
      title: 'Scam Shield',
      description: 'Detects phishing indicators and scam patterns, then assigns a 0–100 risk score to every email.',
    },
    {
      icon: '🔗',
      title: 'URL Scanner',
      description: 'Every link in every email is checked against the Google Safe Browsing API for malware and phishing.',
    },
    {
      icon: '🔒',
      title: 'Quarantine',
      description: 'Suspicious emails are auto-isolated with one-click Safe / Delete actions.',
    },
    {
      icon: '✏️',
      title: 'AI Rewriter',
      description: 'Transform any email with presets — Professional, Shorten, Friendly — or a custom instruction.',
    },
    {
      icon: '📊',
      title: 'Smart Filters',
      description: 'Server-side filtering by sender, label, or scam score, with debounced search.',
    },
    {
      icon: '🔄',
      title: 'AI Failover',
      description: 'Cascading fallback across Groq → Gemini → Cohere — automatic switch on rate limits. NVIDIA reserved for future use.',
    },
  ];

  const providers = [
    { icon: '🟢', name: 'Groq API Key', desc: 'Primary AI provider — Groq LLaMA 3', status: 'Connected · Primary' },
    { icon: '🔵', name: 'Gemini API Key', desc: 'Secondary AI provider — Google Gemini Flash', status: 'Connected · Secondary' },
    { icon: '🟡', name: 'Cohere API Key', desc: 'Tertiary AI provider — Cohere Command-R', status: 'Connected · Tertiary' },
    { icon: '⚪', name: 'NVIDIA API Key', desc: 'Reserved provider (inactive, future use)', status: 'Reserved · Inactive' },
  ];

  const steps = [
    { num: '1', title: 'Connect', desc: 'Google OAuth 2.0 login, secure token flow' },
    { num: '2', title: 'Fetch & Scan', desc: 'Gmail API pulls inbox, bulk AI analysis via SSE (live progress %)' },
    { num: '3', title: 'Classify', desc: 'AI cascade labels + scores every email in real time' },
    { num: '4', title: 'Protect', desc: 'High-risk emails auto-quarantined, links checked vs Safe Browsing' },
    { num: '5', title: 'Act', desc: 'Rewrite, relabel, restore, or delete — all from one dashboard' },
  ];

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* 1. STICKY HEADER / NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'py-3' : 'py-5'
        }`}
        style={{
          background: scrolled ? 'rgba(27, 31, 48, 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <span className="text-2xl">📧</span>
            <span className="text-lg font-bold text-white">Gmail Manager</span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'Architecture', 'Security', 'API'].map((link) => (
              <button
                key={link}
                onClick={() => scrollToSection(link.toLowerCase())}
                className="text-sm text-gray hover:text-white transition-colors relative group"
              >
                {link}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* CTA Button */}
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-lg font-semibold text-white text-sm transition-all duration-200 hover:scale-103"
            style={{
              background: 'var(--primary)',
              boxShadow: '0 4px 12px rgba(76, 111, 255, 0.3)',
            }}
          >
            Try Live Demo →
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Eyebrow Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-xs font-medium"
            style={{
              background: 'var(--info-bg)',
              border: '1px solid var(--info-border)',
              color: 'var(--info)',
            }}
          >
            v1.0.0 · AI-Powered · Multi-Provider Cascade
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Your Inbox, <span className="text-primary">Guarded by AI.</span>
          </h1>

          {/* Subhead */}
          <p className="text-xl md:text-2xl text-gray max-w-4xl mx-auto mb-8 leading-relaxed">
            Smart labeling, phishing detection, and one-click email rewriting — powered by a self-healing AI cascade
            (Groq → Gemini → Cohere) that never goes down.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-lg font-semibold text-white text-lg transition-all duration-200"
              style={{
                background: 'var(--primary)',
                boxShadow: 'var(--neu-flat)',
              }}
            >
              Launch Live App →
            </button>
            <button
              onClick={() => window.open('https://github.com/jm5155/gmail-manager', '_blank')}
              className="btn-secondary px-8 py-4 text-lg flex items-center gap-2"
            >
              <span>⭐</span>
              View Source on GitHub
            </button>
          </div>

          {/* Trust Row */}
          <p className="text-sm text-muted">
            Runs on your own API keys · Emails never leave your machine · MIT Licensed
          </p>
        </div>
      </section>

      {/* 3. STATS STRIP */}
      <section className="py-12 px-6 border-t border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-white mb-2">18</div>
            <div className="text-sm text-gray">API Endpoints</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">4</div>
            <div className="text-sm text-gray">AI Providers</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">0-100</div>
            <div className="text-sm text-gray">Scam Risk Scoring</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">24hr</div>
            <div className="text-sm text-gray">URL Safety Cache</div>
          </div>
        </div>
      </section>

      {/* 4. FEATURES SECTION */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything Your Inbox Needs
            </h2>
            <p className="text-xl text-gray">One dashboard. Full AI-powered protection and control.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="neu-card p-6 hover:scale-105 transition-all duration-200 cursor-pointer group"
                style={{
                  borderLeft: '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderLeftColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }}
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. AI CASCADE / PROVIDER STATUS */}
      <section id="api" className="py-20 px-6" style={{ background: 'rgba(76, 111, 255, 0.03)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Never Goes Down — AI Cascade</h2>
            <p className="text-lg text-gray">
              Automatic failover keeps analysis running even when a provider hits its limit.
            </p>
          </div>

          <div className="space-y-4">
            {providers.map((provider, idx) => (
              <div key={idx} className="neu-card p-6 flex items-start gap-4">
                <div className="text-3xl">{provider.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{provider.name}</h3>
                  <p className="text-sm text-gray mb-2">{provider.desc}</p>
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      background: provider.icon === '⚪' ? 'var(--border-default)' : 'var(--success-bg)',
                      color: provider.icon === '⚪' ? 'var(--text-tertiary)' : 'var(--success)',
                    }}
                  >
                    {provider.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-sm text-muted">
            Flow: Groq (Primary) → Gemini (Secondary) → Cohere (Tertiary) → auto-switch on rate limit / failure
          </div>
        </div>
      </section>

      {/* 6. ARCHITECTURE / HOW IT WORKS */}
      <section id="architecture" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Built for Speed & Reliability</h2>
          </div>

          {/* Steps */}
          <div className="space-y-8 mb-16">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-6">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-gray">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stack Breakdown */}
          <div className="neu-card p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Stack Breakdown</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-primary font-semibold">Frontend</span>
                <span className="text-gray ml-4">React + Vite (port 5173)</span>
              </div>
              <div>
                <span className="text-primary font-semibold">Backend</span>
                <span className="text-gray ml-4">Python FastAPI (port 8000), 18 REST endpoints</span>
              </div>
              <div>
                <span className="text-primary font-semibold">Database</span>
                <span className="text-gray ml-4">SQLite3 — analyzed emails + URL cache</span>
              </div>
              <div>
                <span className="text-primary font-semibold">Desktop</span>
                <span className="text-gray ml-4">Electron wrapper (contextIsolation: true)</span>
              </div>
              <div>
                <span className="text-primary font-semibold">Auth</span>
                <span className="text-gray ml-4">Google OAuth 2.0, token auto-refresh</span>
              </div>
              <div>
                <span className="text-primary font-semibold">AI Cascade</span>
                <span className="text-gray ml-4">Groq → Gemini → Cohere · NVIDIA (Reserved)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECURITY SECTION */}
      <section id="security" className="py-20 px-6" style={{ background: 'rgba(34, 197, 94, 0.03)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-8">🛡️</div>
          <h2 className="text-4xl font-bold text-white mb-8">Privacy-First by Design</h2>

          <div className="space-y-4 text-left max-w-2xl mx-auto">
            {[
              'All credentials stored locally (.env) — never transmitted',
              'OAuth tokens auto-refreshed, stored in token.json',
              'URL safety results cached 24hrs in SQLite',
              'Emails never leave your machine — analysis runs on your own API keys',
              'Electron hardened: contextIsolation on, nodeIntegration off',
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-success text-xl flex-shrink-0">✓</span>
                <span className="text-gray">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA SECTION */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto neu-card p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">See It in Action</h2>
          <p className="text-lg text-gray mb-8">
            No signup walls — connect your Gmail and see AI triage your inbox in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-lg font-semibold text-white text-lg"
              style={{ background: 'var(--primary)', boxShadow: 'var(--neu-flat)' }}
            >
              Try Live Demo →
            </button>
            <button className="btn-secondary px-8 py-4 text-lg">Read the Docs</button>
            <button
              onClick={() => window.open('https://github.com/jm5155/gmail-manager', '_blank')}
              className="btn-secondary px-8 py-4 text-lg"
            >
              ⭐ Star on GitHub
            </button>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="py-12 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-8">
            {/* Left - Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📧</span>
                <span className="text-lg font-bold text-white">Gmail Manager</span>
              </div>
              <p className="text-sm text-gray">
                AI-powered email intelligence, built with a multi-model cascade.
              </p>
            </div>

            {/* Center - Links */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
                <div className="space-y-2 text-sm text-gray">
                  <button onClick={() => scrollToSection('features')} className="block hover:text-white">
                    Features
                  </button>
                  <button onClick={() => navigate('/login')} className="block hover:text-white">
                    Live Demo
                  </button>
                  <button onClick={() => scrollToSection('architecture')} className="block hover:text-white">
                    Architecture
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
                <div className="space-y-2 text-sm text-gray">
                  <a href="#" className="block hover:text-white">
                    Documentation
                  </a>
                  <a href="#" className="block hover:text-white">
                    API Reference
                  </a>
                  <a href="#" className="block hover:text-white">
                    License (MIT)
                  </a>
                </div>
              </div>
            </div>

            {/* Right - Connect */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Connect</h4>
              <a
                href="https://github.com/jm5155/gmail-manager"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray hover:text-white"
              >
                GitHub
              </a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted"
               style={{ borderColor: 'var(--border-subtle)' }}>
            <div>© 2026 Gmail Manager. All rights reserved.</div>
            <div>Emails never leave your machine.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
