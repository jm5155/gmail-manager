/**
 * EmailBodyFrame.jsx — Isolated Email Body Renderer
 * 
 * Renders email bodies faithfully like Gmail:
 * - HTML bodies: sandboxed <iframe> with no script execution
 * - Plain text: <div> with proper word wrapping
 * - Auto-sizes iframe height from content (max 2000px)
 * - All links open in new tab via <base target="_blank">
 * - Sender CSS/markup fully isolated from app
 * - White background for readability on dark theme
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
    // Inject base target, white background, and basic styles
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
              background: #ffffff;
              color: #1a1a1a;
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
              color: #2563eb;
              text-decoration: underline;
            }
            * {
              max-width: 100%;
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
          background: '#ffffff',
          borderRadius: '8px',
          overflow: 'hidden',
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
            backgroundColor: '#ffffff',
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
