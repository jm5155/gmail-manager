/**
 * ScamBadge.jsx — Scam Score Badge Component (Phase 6)
 * Color-coded risk badge with hover tooltip showing score details.
 * 
 * Props:
 *   score (int): Scam score 0-100
 *   reason (string): AI explanation
 *   indicators (array): List of detected scam indicators
 */

import React, { useState } from 'react';

// Risk level configuration based on score ranges
function getRiskLevel(score) {
  if (score === 0) return { label: 'Safe', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' };
  if (score >= 70) return { label: 'High Risk', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
  if (score >= 30) return { label: 'Medium Risk', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
  return { label: 'Low Risk', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' };
}

function ScamBadge({ score, reason, indicators = [] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const risk = getRiskLevel(score);

  return (
    <div className="relative inline-block" style={{ zIndex: showTooltip ? 10000 : 'auto' }}>
      {/* Badge Button */}
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
        style={{
          background: risk.bg,
          color: risk.color,
          border: `1px solid ${risk.border}`,
        }}
      >
        <span className="text-[10px]">🛡️</span>
        <span>{risk.label}</span>
        <span className="font-semibold">{score}%</span>
      </button>

      {/* Tooltip Panel - Fixed z-index and positioning */}
      {showTooltip && (
        <div 
          className="absolute right-0 mt-2 w-72 p-4 rounded-lg shadow-2xl border border-white/10 animate-fadeIn"
          style={{
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            zIndex: 10001,
            top: '100%',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Scam Analysis</h4>
            <span className="text-lg">{score >= 70 ? '🚨' : score >= 30 ? '⚠️' : '✅'}</span>
          </div>

          {/* Score Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-lavender-400 mb-1.5">
              <span>Risk Score</span>
              <span className="font-semibold" style={{ color: risk.color }}>{score}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#0F172A' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: `linear-gradient(90deg, ${risk.color}99, ${risk.color})`,
                }}
              />
            </div>
          </div>

          {/* Indicators */}
          {indicators.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-lavender-300 mb-1.5">Detected Indicators:</h5>
              <ul className="space-y-1">
                {indicators.map((indicator, idx) => (
                  <li key={idx} className="text-xs text-lavender-400 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reason */}
          {reason && (
            <div>
              <h5 className="text-xs font-medium text-lavender-300 mb-1.5">Analysis:</h5>
              <p className="text-xs text-lavender-400 leading-relaxed">{reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScamBadge;
