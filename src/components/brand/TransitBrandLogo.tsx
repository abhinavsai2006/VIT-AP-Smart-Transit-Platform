'use client';

import React from 'react';

interface TransitBrandLogoProps {
  size?: number;
  className?: string;
  variant?: 'solid' | 'dark' | 'outline';
}

export default function TransitBrandLogo({
  size = 36,
  className = '',
  variant = 'solid',
}: TransitBrandLogoProps) {
  const bgFill = variant === 'dark' ? '#1a2129' : variant === 'outline' ? 'transparent' : '#1c69d4';
  const strokeColor = variant === 'outline' ? 'var(--color-primary)' : '#ffffff';

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bgFill,
        border: variant === 'outline' ? '1.5px solid var(--color-primary)' : 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
      aria-label="VIT-AP Smart Transit Logo"
    >
      <svg
        viewBox="0 0 40 40"
        width={Math.round(size * 0.72)}
        height={Math.round(size * 0.72)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Aerodynamic High-Speed Transit Coach Body Frame */}
        <path
          d="M10 11C10 9.34315 11.3431 8 13 8H27C28.6569 8 30 9.34315 30 11L28.8 28.5C28.8 29.8807 27.6807 31 26.3 31H13.7C12.3193 31 11.2 29.8807 11.2 28.5L10 11Z"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />

        {/* Panoramic Curved Windshield */}
        <path
          d="M12 11.5C12 10.6716 12.6716 10 13.5 10H26.5C27.3284 10 28 10.6716 28 11.5L27.2 20.5H12.8L12 11.5Z"
          fill="rgba(255, 255, 255, 0.22)"
          stroke={strokeColor}
          strokeWidth="1.25"
        />

        {/* Digital Destination Route Matrix Bar */}
        <rect
          x="15"
          y="11.5"
          width="10"
          height="2"
          fill={variant === 'outline' ? 'var(--color-primary)' : '#93c5fd'}
        />

        {/* High-Tech LED Horizontal Light Blades */}
        <line
          x1="12.5"
          y1="24.5"
          x2="17.5"
          y2="24.5"
          stroke={variant === 'outline' ? 'var(--color-primary)' : '#ffffff'}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <line
          x1="22.5"
          y1="24.5"
          x2="27.5"
          y2="24.5"
          stroke={variant === 'outline' ? 'var(--color-primary)' : '#ffffff'}
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        {/* Center VIT-AP "V" Speed Ingestion Emblem */}
        <path
          d="M18.5 23.5L20 26.5L21.5 23.5"
          stroke={variant === 'outline' ? 'var(--color-primary)' : '#60a5fa'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Aerodynamic Front Air Splitter / Wheels Stance */}
        <line
          x1="13.5"
          y1="29"
          x2="17"
          y2="29"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <line
          x1="23"
          y1="29"
          x2="26.5"
          y2="29"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>

      {/* Signature BMW-Inspired Tricolor Accent Line at Bottom Edge */}
      {variant !== 'outline' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2.5px',
            display: 'flex',
          }}
        >
          <div style={{ flex: 1, backgroundColor: '#0066b1' }} />
          <div style={{ flex: 1, backgroundColor: '#ffffff' }} />
          <div style={{ flex: 1, backgroundColor: '#e22718' }} />
        </div>
      )}
    </div>
  );
}
