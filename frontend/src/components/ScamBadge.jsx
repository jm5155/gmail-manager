/**
 * ScamBadge.jsx — Scam Score Badge Component (Light Design System)
 * Color-coded risk badge with inline accordion expansion for score details.
 * 
 * Props:
 *   score (int): Scam score 0-100
 *   reason (string): AI explanation
 *   indicators (array): List of detected scam indicators
 *   expanded (bool): Controlled expansion state
 *   onToggle (func): Callback when badge is clicked
 */

import React from 'react';

function ScamBadge({ score = 0, reason = '', indicators = [], expanded = false, onToggle = () => {} }) {
  const getRiskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const getRiskConfig = (level) => {
    const configs = {
      low: {
        label: 'Safe',
        color: '#27AE72',
        bg: 'rgba(39, 174, 114, 0.1)',
        border: 'rgba(39, 174, 114, 0.2)',
      },
      medium: {
        label: 'Suspicious',
        color: '#E5A23C',
        bg: 'rgba(229, 162, 60, 0.1)',
        border: 'rgba(229, 162, 60, 0.2)',
      },
      high: {
        label: 'Dangerous',
        color: '#E05A67',
        bg: 'rgba(224, 90, 103, 0.1)',
        border: 'rgba(224, 90, 103, 0.2)',
      },
    };
    return configs[level];
  };

  const riskLevel = getRiskLevel(score);
  const config = getRiskConfig(riskLevel);

  return (
    <div className="w-full">
      <div
        onClick={onToggle}
        className="w-full rounded-xl transition-all cursor-pointer"
        style={{
          background: config.bg,
          border: `1px solid ${config.border}`,
          padding: '12px 16px',
        }}
      >
        {/* Badge Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Risk Icon */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: config.color,
                color: 'var(--color-text-primary)',
              }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                {riskLevel === 'low' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                )}
              </svg>
            </div>

            {/* Label + Score */}
            <div>
              <div className="text-sm font-semibold" style={{ color: '#20242C' }}>
                {config.label}
              </div>
              <div className="text-xs" style={{ color: '#687386' }}>
                Risk Score: {score}/100
              </div>
            </div>
          </div>

          {/* Expand Arrow */}
          <svg
            className="w-5 h-5 transition-transform flex-shrink-0"
            style={{
              color: config.color,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div
            className="mt-4 pt-4"
            style={{
              borderTop: `1px solid ${config.border}`,
            }}
          >
            {/* Detected Indicators */}
            {indicators && indicators.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-medium mb-2" style={{ color: '#20242C' }}>
                  Detected Indicators:
                </h5>
                <ul className="space-y-1.5">
                  {indicators.map((indicator, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs" style={{ color: '#687386' }}>
                      <span style={{ color: config.color, marginTop: '2px' }}>•</span>
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Analysis */}
            {reason && (
              <div>
                <h5 className="text-xs font-medium mb-1.5" style={{ color: '#20242C' }}>
                  Analysis:
                </h5>
                <p className="text-xs leading-relaxed" style={{ color: '#687386' }}>
                  {reason}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScamBadge;
