import React, { useState, useEffect, useRef } from 'react';

function InfoTooltip({ text }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState('left');
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Calculate best position to avoid overflow
    if (buttonRef.current && tooltipRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 256; // w-64 = 16rem = 256px
      const viewportWidth = window.innerWidth;
      const spaceOnRight = viewportWidth - buttonRect.right;
      
      // If tooltip would overflow on right, position it on the left side
      if (spaceOnRight < tooltipWidth + 16) {
        setPosition('right');
      } else {
        setPosition('left');
      }
    }

    const handleClickOutside = (e) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer"
        style={{
          backgroundColor: isOpen ? 'var(--color-primary)' : 'var(--color-border)',
          color: isOpen ? '#fff' : 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-light)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'var(--color-border)';
          }
        }}
        aria-label="More information"
      >
        ?
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute top-full mt-2 rounded-lg p-3 shadow-lg z-50"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            left: position === 'left' ? '0' : 'auto',
            right: position === 'right' ? '0' : 'auto',
            width: 'max-content',
            maxWidth: 'min(280px, calc(100vw - 2rem))',
          }}
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

export default InfoTooltip;
