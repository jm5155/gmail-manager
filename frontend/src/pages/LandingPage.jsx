/**
 * LandingPage.jsx — Professional Marketing Page
 * Light Design System
 * 
 * Color Palette:
 * - Background: #F1F3F6
 * - Surface: #F8F9FB
 * - Text Primary: #20242C
 * - Text Secondary: #687386
 * - Text Muted: #9AA3B2
 * - Border: #E1E5EB
 * - Primary: #5B5CE2
 * - Success: #27AE72
 * - Warning: #E5A23C
 * - Danger: #E05A67
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Shield, Zap, Brain, Lock, Server, CheckCircle,
  TrendingUp, Clock, Activity, Database, Eye, AlertCircle, Menu, X
} from 'lucide-react';

function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const features = [
    {
      icon: Brain,
      color: '#5B5CE2',
      title: 'AI-Powered Analysis',
      description: 'Extract insights from your emails using advanced AI models with automatic failover across providers.'
    },
    {
      icon: Shield,
      color: '#27AE72',
      title: 'Complete Privacy',
      description: 'Your emails never leave your machine. All processing happens locally with zero cloud storage.'
    },
    {
      icon: Zap,
      color: '#E5A23C',
      title: 'Lightning Fast',
      description: 'Process thousands of emails in minutes with optimized batch operations and parallel processing.'
    },
    {
      icon: Database,
      color: '#3B82F6',
      title: 'Smart Organization',
      description: 'Automatically categorize, tag, and structure your email data for easy retrieval and analysis.'
    },
    {
      icon: TrendingUp,
      color: '#27AE72',
      title: 'Analytics Dashboard',
      description: 'Visualize email patterns, trends, and insights with comprehensive charts and statistics.'
    },
    {
      icon: Lock,
      color: '#E05A67',
      title: 'Secure by Design',
      description: 'Built with security-first architecture. OAuth2 authentication with encrypted local storage.'
    },
    {
      icon: Server,
      color: '#687386',
      title: 'Self-Hosted',
      description: 'Run everything on your own infrastructure. Full control over your data and processing.'
    }
  ];

  const stats = [
    { value: '100%', label: 'Local Processing' },
    { value: '3', label: 'AI Providers' },
    { value: '<2s', label: 'Avg Analysis Time' },
    { value: '∞', label: 'Email Capacity' }
  ];

  const providers = [
    { name: 'Groq', status: 'Primary', color: '#5B5CE2' },
    { name: 'Gemini', status: 'Secondary', color: '#27AE72' },
    { name: 'Cohere', status: 'Tertiary', color: '#E5A23C' }
  ];

  const securityFeatures = [
    { icon: Lock, text: 'OAuth2 Authentication' },
    { icon: Shield, text: 'Zero Cloud Storage' },
    { icon: Eye, text: 'No Data Tracking' },
    { icon: CheckCircle, text: 'Open Source Code' }
  ];

  return (
    <div style={{ 
      backgroundColor: '#F1F3F6', 
      minHeight: '100vh',
      touchAction: 'auto',
      WebkitTouchCallout: 'default',
      userSelect: 'text'
    }}>
      {/* Sticky Navbar */}
      <nav
        style={{
          backgroundColor: '#F8F9FB',
          borderBottom: '1px solid #E1E5EB',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          touchAction: 'auto'
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Mail size={28} style={{ color: '#5B5CE2' }} strokeWidth={1.8} />
              <span style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#20242C'
              }}>
                Gmail Manager
              </span>
            </div>

            {/* Desktop Navigation - Hidden on Mobile */}
            <div className="hidden md:flex items-center gap-4">
              <a
                href="#features"
                style={{ color: '#687386', textDecoration: 'none' }}
                className="hover:opacity-80"
              >
                Features
              </a>
              <a
                href="#security"
                style={{ color: '#687386', textDecoration: 'none' }}
                className="hover:opacity-80"
              >
                Security
              </a>
              <Link
                to="/login"
                style={{
                  backgroundColor: '#5B5CE2',
                  color: '#FFFFFF',
                  padding: '0.625rem 1.5rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'inline-block',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Hamburger Button - Visible on Mobile Only */}
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{
                color: '#20242C',
                backgroundColor: isMenuOpen ? '#E1E5EB' : 'transparent'
              }}
            >
              {isMenuOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
            </button>
          </div>

          {/* Mobile Menu - Dropdown */}
          {isMenuOpen && (
            <div
              className="md:hidden mt-4 pb-4 flex flex-col gap-3"
              style={{
                borderTop: '1px solid #E1E5EB',
                paddingTop: '1rem'
              }}
            >
              <a
                href="#features"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  color: '#20242C',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#F1F3F6',
                  fontWeight: 500
                }}
              >
                Features
              </a>
              <a
                href="#security"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  color: '#20242C',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#F1F3F6',
                  fontWeight: 500
                }}
              >
                Security
              </a>
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  backgroundColor: '#5B5CE2',
                  color: '#FFFFFF',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#F8F9FB',
              border: '1px solid #E1E5EB',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              marginBottom: '2rem'
            }}
          >
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#27AE72'
              }}
            />
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: 600,
              color: '#687386'
            }}>
              100% Private • AI-Powered • Self-Hosted
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6"
            style={{
              lineHeight: 1.1,
              color: '#20242C',
              letterSpacing: '-0.02em'
            }}
          >
            Manage Your Gmail
            <br />
            <span style={{ color: '#5B5CE2' }}>With AI Intelligence</span>
          </h1>

          {/* Subheading */}
          <p
            className="text-base md:text-lg lg:text-xl mb-10"
            style={{
              lineHeight: 1.6,
              color: '#687386',
              maxWidth: '42rem',
              margin: '0 auto 2.5rem'
            }}
          >
            Analyze, organize, and extract insights from thousands of emails using advanced AI.
            Completely private, lightning fast, and fully self-hosted.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/login"
              style={{
                backgroundColor: '#5B5CE2',
                color: 'var(--color-text-primary)',
                padding: '0.875rem 2rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Start Analyzing
              <Zap size={20} strokeWidth={1.8} />
            </Link>
            <a 
              href="#features"
              style={{
                backgroundColor: '#F8F9FB',
                color: '#20242C',
                padding: '0.875rem 2rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.125rem',
                border: '1px solid #E1E5EB',
                display: 'inline-block',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#FFFFFF'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#F8F9FB'}
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="container mx-auto px-6 py-12">
        <div 
          style={{
            backgroundColor: '#F8F9FB',
            borderRadius: '1rem',
            padding: '3rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div 
                  style={{ 
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    color: '#5B5CE2',
                    marginBottom: '0.5rem'
                  }}
                >
                  {stat.value}
                </div>
                <div 
                  style={{ 
                    fontSize: '0.875rem',
                    color: '#687386',
                    fontWeight: 500
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 
            style={{ 
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#20242C',
              marginBottom: '1rem'
            }}
          >
            Powerful Features
          </h2>
          <p style={{ fontSize: '1.125rem', color: '#687386' }}>
            Everything you need to manage and analyze your emails
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                style={{
                  backgroundColor: '#F8F9FB',
                  borderRadius: '1rem',
                  padding: '2rem',
                  border: '1px solid #E1E5EB',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div 
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    backgroundColor: `${feature.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem'
                  }}
                >
                  <IconComponent 
                    size={24} 
                    style={{ color: feature.color }} 
                    strokeWidth={1.8}
                  />
                </div>
                <h3 
                  style={{ 
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#20242C',
                    marginBottom: '0.75rem'
                  }}
                >
                  {feature.title}
                </h3>
                <p style={{ color: '#687386', lineHeight: 1.6 }}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Cascade Section */}
      <section className="container mx-auto px-6 py-24">
        <div 
          style={{
            backgroundColor: '#F8F9FB',
            borderRadius: '1.5rem',
            padding: '4rem',
            border: '1px solid #E1E5EB'
          }}
        >
          <div className="text-center mb-12">
            <h2 
              style={{ 
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#20242C',
                marginBottom: '1rem'
              }}
            >
              Intelligent AI Failover
            </h2>
            <p style={{ fontSize: '1.125rem', color: '#687386' }}>
              Automatic provider switching ensures uninterrupted analysis
            </p>
          </div>

          <div className="flex items-center justify-center gap-8 mb-8">
            {providers.map((provider, index) => (
              <React.Fragment key={index}>
                <div className="text-center">
                  <div 
                    style={{
                      width: '5rem',
                      height: '5rem',
                      borderRadius: '1rem',
                      backgroundColor: `${provider.color}15`,
                      border: `2px solid ${provider.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.75rem',
                      marginLeft: 'auto',
                      marginRight: 'auto'
                    }}
                  >
                    <Activity 
                      size={28} 
                      style={{ color: provider.color }} 
                      strokeWidth={1.8}
                    />
                  </div>
                  <div 
                    style={{ 
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: '#20242C',
                      marginBottom: '0.25rem'
                    }}
                  >
                    {provider.name}
                  </div>
                  <div 
                    style={{
                      fontSize: '0.875rem',
                      color: '#687386',
                      fontWeight: 500
                    }}
                  >
                    {provider.status}
                  </div>
                </div>
                {index < providers.length - 1 && (
                  <div 
                    style={{
                      fontSize: '1.5rem',
                      color: '#9AA3B2',
                      marginTop: '-2rem'
                    }}
                  >
                    →
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div 
            style={{
              backgroundcolor: 'var(--color-text-primary)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid #E1E5EB',
              maxWidth: '48rem',
              margin: '0 auto'
            }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle 
                size={20} 
                style={{ color: '#27AE72', marginTop: '0.125rem' }} 
                strokeWidth={1.8}
              />
              <p style={{ color: '#687386', lineHeight: 1.6, margin: 0 }}>
                If Groq reaches rate limits, the system automatically switches to Gemini.
                If Gemini fails, Cohere takes over. Zero manual intervention required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              style={{ 
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#20242C',
                marginBottom: '1rem'
              }}
            >
              Security First
            </h2>
            <p style={{ fontSize: '1.125rem', color: '#687386' }}>
              Your privacy is our priority. Built with enterprise-grade security.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {securityFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div 
                  key={index}
                  style={{
                    backgroundColor: '#F8F9FB',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    border: '1px solid #E1E5EB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div 
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#27AE7215',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComponent 
                      size={20} 
                      style={{ color: '#27AE72' }} 
                      strokeWidth={1.8}
                    />
                  </div>
                  <span 
                    style={{ 
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#20242C'
                    }}
                  >
                    {feature.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div 
            style={{
              backgroundColor: '#5B5CE215',
              borderRadius: '1rem',
              padding: '2rem',
              border: '1px solid #5B5CE230'
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle 
                size={24} 
                style={{ color: '#5B5CE2', marginTop: '0.125rem', flexShrink: 0 }} 
                strokeWidth={1.8}
              />
              <div>
                <h4 
                  style={{ 
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#20242C',
                    marginBottom: '0.5rem'
                  }}
                >
                  Complete Data Privacy
                </h4>
                <p style={{ color: '#687386', lineHeight: 1.6, margin: 0 }}>
                  All email processing happens locally on your machine. We never store, transmit,
                  or have access to your email content. Your data stays yours, always.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <div 
          style={{
            backgroundColor: '#5B5CE2',
            borderRadius: '1.5rem',
            padding: '4rem',
            textAlign: 'center'
          }}
        >
          <h2
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: '1rem'
            }}
          >
            Ready to Transform Your Email Management?
          </h2>
          <p
            style={{
              fontSize: '1.25rem',
              color: 'rgba(255,255,255,0.9)',
              marginBottom: '2.5rem',
              maxWidth: '42rem',
              margin: '0 auto 2.5rem'
            }}
          >
            Start analyzing your emails with AI-powered intelligence in minutes.
            No credit card required.
          </p>
          <Link
            to="/login"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#5B5CE2',
              padding: '1rem 2.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1.125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Get Started Free
            <Zap size={20} strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer 
        style={{
          backgroundColor: '#F8F9FB',
          borderTop: '1px solid #E1E5EB'
        }}
      >
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Mail size={24} style={{ color: '#5B5CE2' }} strokeWidth={1.8} />
                <span 
                  style={{ 
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#20242C'
                  }}
                >
                  Gmail Manager
                </span>
              </div>
              <p style={{ color: '#687386', fontSize: '0.875rem', lineHeight: 1.6 }}>
                AI-powered email management that respects your privacy.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 
                style={{ 
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#20242C',
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Product
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#features" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Features
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#security" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Security
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <Link to="/login" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 
                style={{ 
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#20242C',
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Company
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    About
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Privacy
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Terms
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 
                style={{ 
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#20242C',
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Resources
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Documentation
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    API Reference
                  </a>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#687386', textDecoration: 'none', fontSize: '0.875rem' }}>
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div 
            style={{
              paddingTop: '2rem',
              borderTop: '1px solid #E1E5EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#9AA3B2' }}>
              © 2026 Gmail Manager. All rights reserved.
            </div>
            <div style={{ fontSize: '0.875rem', color: '#687386', fontWeight: 500 }}>
              🔒 Emails never leave your machine
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
