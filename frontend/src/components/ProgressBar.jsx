/**
 * ProgressBar.jsx — Animated Progress Bar Component (Phase 9)
 * Used during bulk email analysis to show progress.
 * Props: current (int), total (int), label (string)
 */

import React from 'react';

function ProgressBar({ current = 0, total = 0, label = '' }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      {/* Label + Counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-text-secondary">
          {label || `Analyzing ${current} of ${total}...`}
        </span>
        <span className="text-sm font-semibold text-text-primary">{percentage}%</span>
      </div>

      {/* Bar Track */}
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1E293B' }}
      >
        {/* Animated Fill */}
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)',
            boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
          }}
        >
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
            }}
          ></div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default ProgressBar;
