import React, { useState } from 'react';

interface MezaanLogoProps {
  size?: number;
  showTitle?: boolean;
  showTagline?: boolean;
  textColor?: string;
  theme?: 'dark' | 'light';
}

export const MezaanLogo: React.FC<MezaanLogoProps> = ({
  size = 90,
  showTitle = false,
  showTagline = false,
  textColor = '#ffffff',
  theme = 'dark',
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
      {/* High-Resolution Artisanal Crest */}
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          position: 'relative',
          boxShadow:
            theme === 'dark'
              ? '0 0 0 2.5px #f59e0b, 0 8px 24px rgba(0, 0, 0, 0.7)'
              : '0 0 0 2px #b45309, 0 4px 14px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: '#241006',
        }}
      >
        {!imgError ? (
          <img
            src="./mezaan-logo.png"
            alt="Mezaan Sweets & Bakers Logo"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              borderRadius: '50%',
            }}
          />
        ) : (
          <svg
            viewBox="0 0 300 300"
            width={size}
            height={size}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
          <defs>
            {/* Gradients for rich bakery aesthetics */}
            <radialGradient id="badgeBg" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fffbf0" />
              <stop offset="65%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#fde68a" />
            </radialGradient>

            <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#d97706" />
              <stop offset="70%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            <linearGradient id="chocolateRibbon" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#451a03" />
              <stop offset="50%" stopColor="#2e1205" />
              <stop offset="100%" stopColor="#1a0b04" />
            </linearGradient>

            <linearGradient id="cakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5c2b0c" />
              <stop offset="100%" stopColor="#381504" />
            </linearGradient>

            <linearGradient id="sweetGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            <clipPath id="circleClip">
              <circle cx="150" cy="150" r="146" />
            </clipPath>
          </defs>

          {/* Badge Background with Parchment Warmth */}
          <circle cx="150" cy="150" r="148" fill="url(#goldRim)" />
          <circle cx="150" cy="150" r="143" fill="#3e1a07" />
          <circle cx="150" cy="150" r="139" fill="url(#badgeBg)" />
          {/* Inner concentric dotted/dashed guideline */}
          <circle
            cx="150"
            cy="150"
            r="134"
            fill="none"
            stroke="#d97706"
            strokeWidth="1.2"
            strokeDasharray="3,3"
          />

          {/* TOP WHEAT SHEAF (Right Crown) */}
          <g transform="translate(195, 28) rotate(32) scale(0.65)">
            <path
              d="M0,0 Q15,-10 30,-5 Q20,10 0,0 Z M15,-5 Q30,-20 45,-15 Q35,5 15,-5 Z M30,-15 Q45,-30 60,-25 Q50,-5 30,-15 Z"
              fill="#b45309"
              opacity="0.85"
            />
            <path d="M-5,10 Q25,-10 70,-35" stroke="#92400e" strokeWidth="2.5" fill="none" />
          </g>

          {/* TOP BAKER'S TOQUE (Chef Hat) */}
          <g transform="translate(127, 24) scale(0.85)">
            <path
              d="M6,22 C-3,17 -2,3 11,2 C13,-6 33,-7 39,2 C51,1 55,16 47,22 Z"
              fill="#ffffff"
              stroke="#92400e"
              strokeWidth="2.2"
            />
            {/* Pleat lines */}
            <path d="M16,14 C17,7 23,4 27,22" stroke="#d97706" strokeWidth="1.2" fill="none" />
            <path d="M36,14 C35,7 29,4 27,22" stroke="#d97706" strokeWidth="1.2" fill="none" />
            {/* Hat band */}
            <rect x="7" y="21" width="39" height="5" rx="1.5" fill="#fef3c7" stroke="#92400e" strokeWidth="1.5" />
          </g>

          {/* CALLIGRAPHIC MONOGRAM 'M' */}
          <g transform="translate(150, 68)">
            <text
              textAnchor="middle"
              fontFamily="'Cinzel Decorative', 'Times New Roman', serif"
              fontSize="34"
              fontWeight="900"
              fontStyle="italic"
              fill="#451a03"
              letterSpacing="1"
            >
              M
            </text>
          </g>

          {/* BRAND NAME: MEZAAN */}
          <g transform="translate(150, 102)">
            {/* Fine underline flourishes */}
            <path d="M-115,-10 L-75,-10 M75,-10 L115,-10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="-70" cy="-10" r="2" fill="#b45309" />
            <circle cx="70" cy="-10" r="2" fill="#b45309" />

            <text
              textAnchor="middle"
              fontFamily="'Playfair Display', 'Georgia', 'Times New Roman', serif"
              fontSize="32"
              fontWeight="900"
              letterSpacing="2.5"
              fill="#381504"
            >
              MEZAAN
            </text>

            {/* Sub-header: SWEETS & BAKERS */}
            <text
              y="16"
              textAnchor="middle"
              fontFamily="'Inter', 'Arial', sans-serif"
              fontSize="10"
              fontWeight="900"
              letterSpacing="3"
              fill="#78350f"
            >
              • SWEETS &amp; BAKERS •
            </text>

            {/* Urdu Motto: ذائقہ ہمارا، پہچان آپ کی */}
            <text
              y="32"
              textAnchor="middle"
              fontFamily="'Noto Nastaliq Urdu', serif"
              fontSize="12.5"
              fontWeight="700"
              fill="#92400e"
            >
              ذائقہ ہمارا، پہچان آپ کی
            </text>
          </g>

          {/* CENTER SWEET & BAKERY ILLUSTRATIONS (Pastry Trio) */}
          <g transform="translate(68, 146)">
            {/* 1. Cake Slice (Left) */}
            <g transform="translate(8, 0)">
              {/* Cake body */}
              <polygon points="0,38 46,26 46,42 0,54" fill="url(#cakeGrad)" stroke="#2b1104" strokeWidth="1" />
              {/* Cream layer */}
              <polygon points="0,45 46,33 46,36 0,48" fill="#fef08a" />
              {/* Cake top */}
              <polygon points="0,38 24,18 70,8 46,26" fill="#78350f" stroke="#2b1104" strokeWidth="1" />
              <polygon points="24,18 70,8 60,6 14,16" fill="#fef08a" />
              {/* Cherry on top */}
              <circle cx="28" cy="14" r="5.5" fill="#dc2626" />
              <circle cx="26.5" cy="12" r="1.5" fill="#fca5a5" />
              <path d="M28,9 Q32,0 40,2" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </g>

            {/* 2. Frosted Cupcake (Center) */}
            <g transform="translate(82, -2)">
              {/* Cupcake Liner */}
              <polygon points="6,34 32,34 28,52 10,52" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              {/* Liner pleats */}
              <line x1="12" y1="34" x2="14" y2="52" stroke="#92400e" strokeWidth="0.8" />
              <line x1="19" y1="34" x2="19" y2="52" stroke="#92400e" strokeWidth="0.8" />
              <line x1="26" y1="34" x2="24" y2="52" stroke="#92400e" strokeWidth="0.8" />
              {/* Frosting Swirl */}
              <path
                d="M4,34 C1,26 8,20 14,21 C12,14 22,9 27,14 C33,12 37,20 34,26 C38,30 35,34 31,34 Z"
                fill="#fffbf0"
                stroke="#d97706"
                strokeWidth="1.2"
              />
              {/* Swirl spiral & sprinkles */}
              <path d="M10,28 Q19,20 28,26 M14,20 Q20,15 25,18" stroke="#f59e0b" strokeWidth="1.2" fill="none" />
              <circle cx="16" cy="24" r="1.2" fill="#ef4444" />
              <circle cx="24" cy="22" r="1.2" fill="#3b82f6" />
              <circle cx="20" cy="17" r="1.2" fill="#10b981" />
            </g>

            {/* 3. Bowl of Golden Traditional Sweets (Right) */}
            <g transform="translate(126, 6)">
              {/* Sweets Bowl */}
              <path
                d="M4,32 C4,48 38,48 38,32 Z"
                fill="#ffffff"
                stroke="#b45309"
                strokeWidth="1.2"
              />
              <path d="M14,44 L28,44 L25,48 L17,48 Z" fill="#b45309" />
              {/* Golden Sweets (Gulab Jamun / Laddus) */}
              <circle cx="14" cy="28" r="6.5" fill="url(#sweetGold)" stroke="#78350f" strokeWidth="0.8" />
              <circle cx="27" cy="28" r="6.5" fill="url(#sweetGold)" stroke="#78350f" strokeWidth="0.8" />
              <circle cx="21" cy="20" r="7" fill="url(#sweetGold)" stroke="#78350f" strokeWidth="0.8" />
              {/* Sweet highlight glazes */}
              <circle cx="19" cy="18" r="1.8" fill="#fef08a" opacity="0.8" />
              <circle cx="12" cy="26" r="1.5" fill="#fef08a" opacity="0.8" />
              <circle cx="25" cy="26" r="1.5" fill="#fef08a" opacity="0.8" />
            </g>
          </g>

          {/* BOTTOM RIBBON: 'FRESH & PREMIUM QUALITY' */}
          <g transform="translate(150, 240)">
            {/* Left ribbon fishtail */}
            <polygon points="-120,4 -105,-10 -90,-10 -90,14 -105,14" fill="#2b1104" stroke="#d97706" strokeWidth="1" />
            {/* Right ribbon fishtail */}
            <polygon points="120,4 105,-10 90,-10 90,14 105,14" fill="#2b1104" stroke="#d97706" strokeWidth="1" />

            {/* Central Curved Chocolate Banner */}
            <path
              d="M-98,-12 Q0,-18 98,-12 L94,14 Q0,10 -94,14 Z"
              fill="url(#chocolateRibbon)"
              stroke="#fbbf24"
              strokeWidth="1.8"
            />

            {/* Golden Ribbon Text */}
            <text
              y="2"
              textAnchor="middle"
              fontFamily="'Inter', 'Arial Black', sans-serif"
              fontSize="8.5"
              fontWeight="900"
              letterSpacing="1.8"
              fill="#fbbf24"
            >
              FRESH &amp; PREMIUM QUALITY
            </text>

            {/* Tiny bottom scroll flourish */}
            <path
              d="M-24,18 Q0,24 24,18"
              stroke="#d97706"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </svg>
        )}
      </div>

      {/* Optional Brand Title & Taglines (When inline) */}
      {(showTitle || showTagline) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {showTitle && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                  fontSize: size >= 70 ? '22px' : '16px',
                  fontWeight: 700,
                  color: textColor === '#ffffff' ? '#fbbf24' : '#92400e',
                  lineHeight: 1.4,
                  letterSpacing: '0.5px',
                }}
              >
                میزان سویٹس اینڈ بیکرز
              </span>
              <span
                style={{
                  fontSize: size >= 70 ? '12px' : '10px',
                  fontWeight: 800,
                  letterSpacing: '1.2px',
                  color: textColor,
                  textTransform: 'uppercase',
                  marginTop: '-2px',
                }}
              >
                MEZAAN SWEETS &amp; BAKERS
              </span>
            </div>
          )}

          {showTagline && (
            <span
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                fontSize: size >= 70 ? '12px' : '10px',
                color: theme === 'dark' ? '#fde68a' : '#b45309',
                marginTop: '3px',
              }}
            >
              تازہ اور معیاری مٹھائیوں کا مرکز
            </span>
          )}
        </div>
      )}
    </div>
  );
};
