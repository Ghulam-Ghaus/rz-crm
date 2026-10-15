import React from 'react';

interface RzLogoProps {
  size?: number;
  showTitle?: boolean;
  showTagline?: boolean;
  textColor?: string;
  theme?: 'dark' | 'light';
}

export const RzLogo: React.FC<RzLogoProps> = ({
  size = 90,
  showTitle = false,
  showTagline = false,
  textColor = '#ffffff',
  theme = 'dark',
}) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
      {/* Dynamic Modern RZ Enterprises Emblem */}
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: Math.round(size * 0.24),
          position: 'relative',
          boxShadow:
            theme === 'dark'
              ? '0 0 0 2px rgba(99, 102, 241, 0.5), 0 10px 25px -5px rgba(15, 23, 42, 0.8), 0 8px 16px -6px rgba(79, 70, 229, 0.4)'
              : '0 0 0 1.5px rgba(99, 102, 241, 0.3), 0 4px 14px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="rzGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <radialGradient id="glowG" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Glow */}
          <rect width="120" height="120" fill="url(#glowG)" />

          {/* Geometric Inner Shield */}
          <rect
            x="12"
            y="12"
            width="96"
            height="96"
            rx="20"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />

          {/* Letter 'R' */}
          <path
            d="M 32 32 L 52 32 C 62 32 68 37 68 46 C 68 53 63 58 54 59 L 70 88 L 56 88 L 43 64 L 43 88 L 32 88 Z M 43 42 L 43 54 L 51 54 C 55 54 58 52 58 48 C 58 44 55 42 51 42 Z"
            fill="url(#rzGrad)"
          />

          {/* Letter 'Z' */}
          <path
            d="M 64 36 L 90 36 L 90 44 L 74 78 L 91 78 L 91 88 L 62 88 L 62 80 L 78 46 L 64 46 Z"
            fill="url(#goldAccent)"
          />

          {/* Dot badge */}
          <circle cx="94" cy="30" r="3.5" fill="#38bdf8" />
        </svg>
      </div>

      {/* Text Branding if enabled */}
      {(showTitle || showTagline) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {showTitle && (
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: `${Math.max(16, size * 0.38)}px`,
                fontWeight: 800,
                letterSpacing: '0.8px',
                color: textColor,
                textTransform: 'uppercase',
                lineHeight: 1.15,
              }}
            >
              RZ Enterprises
            </div>
          )}
          {showTagline && (
            <div
              style={{
                fontSize: `${Math.max(11, size * 0.18)}px`,
                fontWeight: 600,
                letterSpacing: '1.2px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                marginTop: '3px',
              }}
            >
              Trading & CRM System
            </div>
          )}
        </div>
      )}
    </div>
  );
};
