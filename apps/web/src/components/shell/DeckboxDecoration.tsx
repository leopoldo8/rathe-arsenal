import React from 'react';
import styles from './DeckboxDecoration.module.css';

/**
 * DeckboxDecoration — inline SVG deckbox used in the AuthLayout left panel.
 * Intentionally aria-hidden at the point of use; this component is purely decorative.
 */
export function DeckboxDecoration(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 104 104"
      overflow="visible"
      className={styles.svg}
      aria-hidden="true"
      style={{ color: 'var(--ra-accent)' }}
    >
      <defs>
        <linearGradient id="ra-box-front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7a2222" />
          <stop offset="60%" stopColor="#5a1a1a" />
          <stop offset="100%" stopColor="#3a0f0f" />
        </linearGradient>
        <linearGradient id="ra-box-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3a0f0f" />
          <stop offset="100%" stopColor="#2a0808" />
        </linearGradient>
        <linearGradient id="ra-lid-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a2222" />
          <stop offset="100%" stopColor="#4a1414" />
        </linearGradient>
        <linearGradient id="ra-card-base-shadow" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ra-above-rim" clipPathUnits="userSpaceOnUse">
          <polygon points="-10,-10 110,-10 110,24 72,24 60,32 24,36 -10,36" />
        </clipPath>
        <clipPath id="ra-clip-card-back" clipPathUnits="userSpaceOnUse">
          <path d="M36 34.9 L 72 30.9 L 72 2 L 36 6 Z" />
        </clipPath>
        <clipPath id="ra-clip-card-middle" clipPathUnits="userSpaceOnUse">
          <path d="M30 35.6 L 66 31.6 L 66 8 L 30 12 Z" />
        </clipPath>
        <clipPath id="ra-clip-card-front" clipPathUnits="userSpaceOnUse">
          <path d="M24 36 L 60 32 L 60 14 L 24 18 Z" />
        </clipPath>
      </defs>
      <path d="M36 28 L 72 24 L 72 96 L 36 96 Z" fill="#3a0f0f" stroke="currentColor" strokeWidth="0.6" />
      <path d="M60 32 L 72 24 L 72 96 L 60 96 Z" fill="url(#ra-box-side)" stroke="currentColor" strokeWidth="0.8" />
      <path d="M24 36 L 60 32 L 60 96 L 24 96 Z" fill="url(#ra-box-front)" stroke="currentColor" strokeWidth="1" />
      <path d="M27 41 L 57 37 L 57 92 L 27 92 Z" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.75" />
      <text
        x="42" y="72" textAnchor="middle"
        fontFamily="UnifrakturCook, serif"
        fontWeight="700" fontSize="26"
        fill="currentColor"
      >
        R
      </text>
      <path d="M36 28 L 72 24 L 78 12 L 42 16 Z" fill="#3a0f0f" stroke="currentColor" strokeWidth="0.8" />
      <path d="M42 16 L 78 12 L 78 6 L 42 10 Z" fill="url(#ra-lid-top)" stroke="currentColor" strokeWidth="0.8" />
      <path d="M38.5 26.5 L 70.5 23 L 75 14 L 44 17.5 Z" fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.55" />
      <path d="M24 36 L 60 32 L 72 24 L 36 28 Z" fill="#120303" stroke="currentColor" strokeWidth="0.9" />
      <path d="M27 35.2 L 58 31.5 L 69 24.9 L 38 28.6 Z" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.55" />
      <g clipPath="url(#ra-above-rim)">
        <g clipPath="url(#ra-clip-card-back)">
          <path d="M36 34.9 L 72 30.9 L 72 2 L 36 6 Z" fill="#faf3e0" stroke="#b5a67c" strokeWidth="0.45" />
          <path d="M36 34.9 L 72 30.9 L 72 28.9 L 36 32.9 Z" fill="url(#ra-card-base-shadow)" />
        </g>
        <g clipPath="url(#ra-clip-card-middle)">
          <path d="M30 35.6 L 66 31.6 L 66 8 L 30 12 Z" fill="#f0e6cc" stroke="#b5a67c" strokeWidth="0.45" />
          <path d="M30 35.6 L 66 31.6 L 66 29.6 L 30 33.6 Z" fill="url(#ra-card-base-shadow)" />
        </g>
        <g clipPath="url(#ra-clip-card-front)">
          <path d="M24 36 L 60 32 L 60 14 L 24 18 Z" fill="#faf3e0" stroke="#b5a67c" strokeWidth="0.5" />
          <path d="M24 36 L 60 32 L 60 30 L 24 34 Z" fill="url(#ra-card-base-shadow)" />
        </g>
      </g>
    </svg>
  );
}
