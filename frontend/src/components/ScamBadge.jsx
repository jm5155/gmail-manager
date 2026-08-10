/**
 * ScamBadge.jsx — Scam Score Badge Component (Unified Neumorphic Design)
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

// Risk level configuration based on score ranges
function getRiskLevel(score) {
  if (score === 0) return { label: 'Safe', badge: 'badge-success', icon: '✅' };
  if (score >= 70) return { label: 'High Risk', badge: 'badge-danger', icon: '🚨' };
  if (score >= 30) return { label: 'Medium Risk', badge: 'badge-warning', icon: '⚠️' };
  return { label: 'Low Risk', badge: 'badge-success', icon: '✅' };
}

// Truncate URL to domain + path only, no query strings
function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    return `${domain}${path}`;
  } catch {
    // If URL parsing fails, truncate to 50 chars
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

function ScamBadge({ score, reason, indicators = [], expanded = false, onToggle }) {
  const risk = getRiskLevel(score);

  return (
    <div className="flex flex-col gap-2">
      {/* Badge Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onToggle) onToggle();
        }}
        className={`badge ${risk.badge} cursor-pointer transition-all hover:scale-105 active:scale-95`}
      >
        <span>{risk.icon}</span>
        <span>{risk.label}</span>
        <span className="font-bold">{score}%</span>
        <span className="text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Inline Accordion Content */}
      <div 
        className="accordion-content"
        data-expanded={expanded}
      >
        {expanded && (
          <div className="neu-card p-4 space-y-3 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Scam Analysis</h4>
              <span className="text-lg">{risk.icon}</span>
            </div>

            {/* Score Bar */}
            <div>
              <div className="flex justify-between text-xs text-gray mb-1.5">
                <span>Risk Score</span>
                <span className="font-semibold" style={{ color: `var(--${score >= 70 ? 'danger' : score >= 30 ? 'warning' : 'success'})` }}>
                  {score}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-light)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: score >= 70 ? 'var(--danger)' : score >= 30 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            </div>

            {/* Indicators */}
            {indicators.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-white mb-1.5">Detected Indicators:</h5>
                <ul className="space-y-1">
                  {indicators.map((indicator, idx) => (
                    <li key={idx} className="text-xs text-gray flex items-start gap-1.5">
                      <span className="text-danger mt-0.5">•</span>
                      <span className="truncate-url">{truncateUrl(indicator)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason */}
            {reason && (
              <div>
                <h5 className="text-xs font-medium text-white mb-1.5">Analysis:</h5>
                <p className="text-xs text-gray leading-relaxed">{reason}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScamBadge;
