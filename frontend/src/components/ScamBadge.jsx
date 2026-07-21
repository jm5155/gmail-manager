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
function getRiskConfig(score) {
  if (score >= 81) return { label: 'Danger', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
  if (score >= 61) return { label: 'High Risk', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' };
  if (score >= 31) return { label: 'Moderate Risk', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
  return { label: 'Low Risk', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' };
}

function ScamBadge({ score = 0, reason = '', indicators = [] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const risk = getRiskConfig(score);

  // Parse indicators if it's a JSON string
  let parsedIndicators = indicators;
  if (typeof indicators === 'string') {
    try { parsedIndicators = JSON.parse(indicators); } catch { parsedIndicators = []; }
  }

  return (
    <div className="relative inline-block">
      {/* Badge pill */}
      <div
        className="px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-105"
        style={{
          background: risk.bg,
          color: risk.color,
          border: `1px solid ${risk.border}`,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {score} — {risk.label}
      </div>

      {/* Hover Tooltip Card */}
      {showTooltip && (score > 0 || reason) && (
        <div
          className="absolute z-50 right-0 top-full mt-2 w-72 p-4 rounded-xl text-sm"
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6)',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Score Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-text-secondary">Scam Score</span>
              <span style={{ color: risk.color }} className="font-bold">{score}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#0F172A' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: `linear-gradient(90deg, #22C55E 0%, #F59E0B 50%, #EF4444 100%)`,
                }}
              ></div>
            </div>
          </div>

          {/* Reason */}
          {reason && (
            <p className="text-text-secondary text-xs mb-3 leading-relaxed">
              {reason}
            </p>
          )}

          {/* Indicators */}
          {parsedIndicators.length > 0 && (
            <div>
              <p className="text-text-secondary text-xs font-semibold mb-1.5">Indicators:</p>
              <ul className="space-y-1">
                {parsedIndicators.map((indicator, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-xs text-text-secondary">
                    <span style={{ color: risk.color }} className="mt-0.5 flex-shrink-0">•</span>
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScamBadge;
