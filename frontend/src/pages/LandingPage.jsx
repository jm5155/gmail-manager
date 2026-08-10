/**
 * LandingPage.jsx — Hero Landing Page for Gmail Manager Intelligence
 * Professional marketing page with hero section, features, and CTA
 * 
 * Sections:
 * - Hero with animated headline
 * - Features grid
 * - Stats showcase
 * - Call-to-action
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Analysis',
      description: 'Analyze thousands of emails with advanced AI to detect scams, phishing, and spam automatically.',
    },
    {
      icon: '🛡️',
      title: 'Scam Detection',
      description: 'Real-time scam scoring with detailed threat analysis and safety recommendations.',
    },
    {
      icon: '🏷️',
      title: 'Smart Categorization',
      description: 'Automatically organize emails into categories with custom labels and filters.',
    },
    {
      icon: '✍️',
      title: 'Email Rewriter',
      description: 'Transform your emails with AI - make them professional, friendly, or concise instantly.',
    },
    {
      icon: '🔒',
      title: 'Quarantine System',
      description: 'Isolate suspicious emails before they reach your inbox. Review and restore safely.',
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Analyze 100+ emails in seconds with our optimized AI cascade system.',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Emails Analyzed' },
    { value: '99.8%', label: 'Accuracy Rate' },
    { value: '<2s', label: 'Average Scan Time' },
    { value: '24/7', label: 'Protection' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Hero Background Gradient */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20 blur-3xl"
            style={{
              background: 'radial-gradient(circle, #4C6FFF 0%, transparent 70%)',
              animation: 'pulse 8s ease-in-out infinite',
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
               style={{
                 background: 'var(--info-bg)',
                 border: '1px solid var(--info-border)',
               }}>
            <span className="text-info text-sm font-medium">✨ AI-Powered Email Intelligence</span>
          </div>

          {/* Hero Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Your Gmail Inbox,
            <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent"
                  style={{ backgroundSize: '200% auto', animation: 'gradient 3s linear infinite' }}>
              Supercharged with AI
            </span>
          </h1>

          {/* Hero Subheading */}
          <p className="text-xl md:text-2xl text-gray max-w-3xl mx-auto mb-10 leading-relaxed">
            Automatically detect scams, organize emails, and take control of your inbox
            with advanced AI analysis. Stop spam before it reaches you.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary px-8 py-4 text-lg min-w-[200px] flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
            <button
              onClick={() => {
                document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-secondary px-8 py-4 text-lg min-w-[200px]"
            >
              Learn More
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="neu-card p-6">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-gray">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to
              <span className="text-accent"> Protect Your Inbox</span>
            </h2>
            <p className="text-xl text-gray max-w-2xl mx-auto">
              Advanced AI-powered features that work together to keep your email safe and organized.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="neu-card p-6 hover:scale-105 transition-transform duration-200"
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray">
              Get started in seconds with our simple 3-step process.
            </p>
          </div>

          <div className="space-y-12">
            {[
              { step: '01', title: 'Connect Your Gmail', desc: 'Sign in securely with Google OAuth. We never store your password.' },
              { step: '02', title: 'AI Analyzes Your Inbox', desc: 'Our AI scans your emails for scams, phishing, and spam in real-time.' },
              { step: '03', title: 'Stay Protected', desc: 'Get instant alerts, quarantine threats, and keep your inbox clean.' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-6">
                <div
                  className="text-6xl font-bold opacity-20"
                  style={{ color: 'var(--primary)' }}
                >
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-lg text-gray">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto neu-card p-12 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Take Control?
          </h2>
          <p className="text-xl text-gray mb-8 max-w-2xl mx-auto">
            Join thousands of users protecting their inbox with AI-powered intelligence.
            Get started for free today.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary px-10 py-5 text-xl"
          >
            Get Started Now →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray text-sm">
            © 2026 Gmail Manager Intelligence. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-gray text-sm">
            <span>Made with AI</span>
            <span>•</span>
            <span>Powered by Google</span>
          </div>
        </div>
      </footer>

      {/* Gradient Animation */}
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

export default LandingPage;
