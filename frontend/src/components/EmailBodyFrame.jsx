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
    
    return {
      background: computed.getPropertyValue('--color-surface').trim() || '#ffffff',
      text: computed.getPropertyValue('--color-text-primary').trim() || '#1a1a1a',
      border: computed.getPropertyValue('--color-border').trim() || '#e5e7eb',
      link: computed.getPropertyValue('--color-primary').trim() || '#2563eb',
    };
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
            /* Override any sender-provided background colors in dark mode */
            [style*="background-color: rgb(255, 255, 255)"],
            [style*="background-color: #ffffff"],
            [style*="background-color: white"],
            [bgcolor="white"],
            [bgcolor="#ffffff"] {
              background-color: ${colors.background} !important;
            }
            /* Override black text in dark mode */
            [style*="color: rgb(0, 0, 0)"],
            [style*="color: #000000"],
            [style*="color: black"] {
              color: ${colors.text} !important;
            }
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
