/**
 * EmailBodyFrame.jsx — Isolated Email Body Renderer
 * 
 * Renders email bodies faithfully like Gmail:
 * - HTML bodies: sandboxed <iframe> with no script execution
 * - Plain text: <div> with proper word wrapping
 * - Auto-sizes iframe height from content (max 2000px)
 * - All links open in new tab via <base target="_blank">
 * - Sender CSS/markup fully isolated from app
 * - Theme-aware: respects light/dark mode (FIXED 2026-09-11)
 */

import React, { useRef, useEffect } from 'react';

function EmailBodyFrame({ body, className = '', textStyle = {} }) {
  const iframeRef = useRef(null);

  // Detect if body contains HTML tags
  const looksLikeHTML = (text) => {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
  };

  const isHTML = looksLikeHTML(body);

  // Get current theme colors from CSS variables
  const getThemeColors = () => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    
    const background = computed.getPropertyValue('--color-surface').trim() || '#ffffff';
    const text = computed.getPropertyValue('--color-text-primary').trim() || '#1a1a1a';
    
    // Detect if we're in dark mode by checking background luminance
    const isDark = isColorDark(background);
    
    return {
      background,
      text,
      border: computed.getPropertyValue('--color-border').trim() || '#e5e7eb',
      link: computed.getPropertyValue('--color-primary').trim() || '#2563eb',
      isDark,
    };
  };
  
  // Helper to detect if a color is dark
  const isColorDark = (color) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  // Auto-resize iframe to fit content
  useEffect(() => {
    if (!isHTML || !iframeRef.current) return;

    const measure = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentDocument) return;

        const contentHeight = iframe.contentDocument.body?.scrollHeight || 0;
        // Cap at 2000px to prevent excessive heights
        iframe.style.height = `${Math.min(contentHeight + 20, 2000)}px`;
      } catch (err) {
        // Cross-origin or blocked access - fail silently
        console.debug('[EmailBodyFrame] Could not measure iframe height:', err);
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', measure);
      
      // Also check periodically for dynamic content
      const resizeInterval = setInterval(measure, 500);
      
      return () => {
        iframe.removeEventListener('load', measure);
        clearInterval(resizeInterval);
      };
    }
  }, [isHTML, body]);

  // HTML body - render in sandboxed iframe
  if (isHTML) {
    const colors = getThemeColors();
    
    // Inject base target, theme colors, and basic styles
    const iframeContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <base target="_blank">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: ${colors.background};
              color: ${colors.text};
            }
            body {
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              word-wrap: break-word;
              overflow-wrap: anywhere;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            table {
              max-width: 100%;
            }
            a {
              color: ${colors.link};
              text-decoration: underline;
            }
            * {
              max-width: 100%;
            }
            ${colors.isDark ? `
            /* DARK MODE EMAIL TRANSFORMATION */
            
            /* Force all light backgrounds to dark */
            [style*="background-color: #fff"],
            [style*="background-color: #FFF"],
            [style*="background-color: white"],
            [style*="background-color: rgb(255"],
            [style*="background: #fff"],
            [style*="background: white"],
            [bgcolor="white"],
            [bgcolor="#ffffff"],
            [bgcolor="#FFFFFF"],
            table[style*="background"],
            td[style*="background"],
            div[style*="background-color"] {
              background-color: ${colors.background} !important;
              background: ${colors.background} !important;
            }
            
            /* Force all dark text to light */
            [style*="color: #000"],
            [style*="color: black"],
            [style*="color: rgb(0"],
            [style*="color:#000"],
            font[color],
            span[style*="color"],
            p[style*="color"],
            div[style*="color"],
            td[style*="color"],
            h1, h2, h3, h4, h5, h6 {
              color: ${colors.text} !important;
            }
            
            /* Ensure body and all containers are dark */
            body, body > div, body > table, body > center {
              background-color: ${colors.background} !important;
              color: ${colors.text} !important;
            }
            
            /* Fix tables (common in email HTML) */
            table {
              background-color: transparent !important;
              color: ${colors.text} !important;
            }
            
            td, th {
              color: ${colors.text} !important;
            }
            
            /* Invert images that look like logos/graphics on light backgrounds */
            img[style*="background"] {
              background-color: transparent !important;
            }
            ` : ''}
          </style>
        </head>
        <body>
          ${body}
        </body>
      </html>
    `;

    return (
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={iframeContent}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className={className}
          style={{
            width: '100%',
            border: 'none',
            display: 'block',
            minHeight: '360px',
            backgroundColor: 'var(--color-surface)',
          }}
          title="Email content"
        />
      </div>
    );
  }

  // Plain text body - render with word wrapping
  return (
    <div
      className={className}
      style={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        ...textStyle,
      }}
    >
      {body || 'No content available'}
    </div>
  );
}

export default EmailBodyFrame;
