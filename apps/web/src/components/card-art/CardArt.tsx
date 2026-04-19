import React from 'react';
import styles from './CardArt.module.css';

import AttackGlyph from './glyphs/attack.svg?react';
import DefenseGlyph from './glyphs/defense.svg?react';
import InstantGlyph from './glyphs/instant.svg?react';
import EquipmentGlyph from './glyphs/equipment.svg?react';
import AllyGlyph from './glyphs/ally.svg?react';
import WeaponGlyph from './glyphs/weapon.svg?react';
import HeroGlyph from './glyphs/hero.svg?react';
import DeckboxGlyph from './glyphs/deckbox.svg?react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TCardArtSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ICardArtProps {
  /** Card name — shown in the name band and used as aria-label. */
  readonly name: string;
  /** Pitch value. Drives frame color. null = colorless (weapon/equipment/hero). */
  readonly pitch: 1 | 2 | 3 | null;
  /** Resource cost. null = no cost diamond rendered. */
  readonly cost: number | null;
  /** Card type string. Drives the type glyph. Unknown types fall back to deckbox. */
  readonly type: string;
  /** When true, renders a diagonal-hatch overlay + reduced opacity. */
  readonly missing: boolean;
  /** Size preset. Controls overall card dimensions. */
  readonly size: TCardArtSize;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pixel width for each size preset (R48). */
const SIZE_WIDTH_MAP: Record<TCardArtSize, number> = {
  xs: 40,
  sm: 72,
  md: 120,
  lg: 200,
};

/**
 * Card aspect ratio — 7:10 (width:height) is a close approximation to the
 * standard FaB card dimension.
 */
const ASPECT_RATIO = 10 / 7;

/** Frame color tokens per pitch value. Maps directly to CSS custom properties. */
const PITCH_FRAME_VARS: Record<string, { frame: string; bg: string; ink: string; sym: string }> = {
  '1': {
    frame: 'var(--ra-card-frame-red)',
    bg: 'var(--ra-card-frame-red-bg)',
    ink: 'var(--ra-card-frame-red-ink)',
    sym: 'var(--ra-card-frame-red-sym)',
  },
  '2': {
    frame: 'var(--ra-card-frame-yellow)',
    bg: 'var(--ra-card-frame-yellow-bg)',
    ink: 'var(--ra-card-frame-yellow-ink)',
    sym: 'var(--ra-card-frame-yellow-sym)',
  },
  '3': {
    frame: 'var(--ra-card-frame-blue)',
    bg: 'var(--ra-card-frame-blue-bg)',
    ink: 'var(--ra-card-frame-blue-ink)',
    sym: 'var(--ra-card-frame-blue-sym)',
  },
  colorless: {
    frame: 'var(--ra-card-frame-colorless)',
    bg: 'var(--ra-card-frame-colorless-bg)',
    ink: 'var(--ra-card-frame-colorless-ink)',
    sym: 'var(--ra-card-frame-colorless-sym)',
  },
};

/** Map of recognized card type strings to their glyph component. */
const TYPE_GLYPH_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  attack: AttackGlyph,
  'attack-action': AttackGlyph,
  defense: DefenseGlyph,
  'defense-reaction': DefenseGlyph,
  instant: InstantGlyph,
  equipment: EquipmentGlyph,
  ally: AllyGlyph,
  weapon: WeaponGlyph,
  hero: HeroGlyph,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveGlyph(
  type: string,
): React.FC<React.SVGProps<SVGSVGElement>> {
  const normalized = type.trim().toLowerCase();
  return TYPE_GLYPH_MAP[normalized] ?? DeckboxGlyph;
}

function resolvePitchKey(pitch: 1 | 2 | 3 | null): string {
  if (pitch === null) return 'colorless';
  return String(pitch);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CardArt — stylized FaB-style card face placeholder.
 *
 * Renders a compact SVG card frame with pitch-colored border, cost diamond,
 * pitch pips, name band, and a type glyph. When `missing=true`, a diagonal
 * hatch overlay is drawn to indicate the card is not in the user's collection
 * — this is a "not owned" state, NOT an error state.
 *
 * A11y: the root SVG carries role="img" + aria-label={name}.
 */
export function CardArt({
  name,
  pitch,
  cost,
  type,
  missing,
  size,
}: ICardArtProps): React.ReactElement {
  const width = SIZE_WIDTH_MAP[size];
  const height = Math.round(width * ASPECT_RATIO);

  const pitchKey = resolvePitchKey(pitch);
  const colors = PITCH_FRAME_VARS[pitchKey];

  const TypeGlyphComponent = resolveGlyph(type);

  const cssVars = {
    '--card-frame': colors.frame,
    '--card-bg': colors.bg,
    '--card-ink': colors.ink,
    '--card-sym': colors.sym,
  } as React.CSSProperties;

  const containerClass = [
    styles.cardArt,
    styles[`cardArt--${size}`],
    missing ? styles['cardArt--missing'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass} style={cssVars} data-testid="card-art">
      <svg
        viewBox="0 0 100 140"
        width={width}
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={name}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Diagonal hatch pattern definition (used only when missing=true) */}
        {missing && (
          <defs>
            <pattern
              id={`ra-hatch-${size}`}
              x="0"
              y="0"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,0,0,0.55)" strokeWidth="3" />
            </pattern>
          </defs>
        )}

        {/* Card base */}
        <rect
          x="2"
          y="2"
          width="96"
          height="136"
          rx="5"
          ry="5"
          fill="var(--card-bg)"
          stroke="var(--card-frame)"
          strokeWidth="1.5"
          data-testid="card-frame"
        />

        {/* Outer double frame — subtle inner border for depth */}
        <rect
          x="4.5"
          y="4.5"
          width="91"
          height="131"
          rx="3.5"
          ry="3.5"
          fill="none"
          stroke="var(--card-frame)"
          strokeWidth="0.4"
          opacity="0.6"
        />

        {/* Art panel background */}
        <rect
          x="10"
          y="22"
          width="80"
          height="70"
          rx="1.5"
          ry="1.5"
          fill="#000"
          fillOpacity="0.35"
          stroke="var(--card-frame)"
          strokeWidth="0.4"
        />

        {/* Type glyph — scaled into the art panel */}
        <g
          transform="translate(10 22) scale(0.8 0.8)"
          style={{ color: 'var(--card-sym)' }}
          data-testid="type-glyph"
        >
          <TypeGlyphComponent aria-hidden="true" />
        </g>

        {/* Cost diamond (top-left) — only rendered when cost is not null */}
        {cost !== null && (
          <g data-testid="cost-diamond">
            <path
              d="M15 15 L22 8 L29 15 L22 22 Z"
              fill="var(--card-frame)"
              stroke="var(--card-bg)"
              strokeWidth="1"
            />
            <text
              x="22"
              y="18.5"
              textAnchor="middle"
              fontSize="9.5"
              fontFamily="'Cinzel', serif"
              fontWeight="700"
              fill="var(--card-bg)"
            >
              {cost}
            </text>
          </g>
        )}

        {/* Pitch pip (top-right) — only rendered when pitch is not null */}
        {pitch !== null && (
          <g data-testid="pitch-pip">
            <circle
              cx="82"
              cy="14"
              r="7"
              fill="var(--card-bg)"
              stroke="var(--card-frame)"
              strokeWidth="1"
            />
            {Array.from({ length: pitch }).map((_, i) => (
              <circle
                key={i}
                cx={76 + i * 4}
                cy="14"
                r="1.4"
                fill="var(--card-sym)"
              />
            ))}
          </g>
        )}

        {/* Name band */}
        <rect
          x="10"
          y="95"
          width="80"
          height="14"
          rx="1"
          ry="1"
          fill="#000"
          fillOpacity="0.55"
        />
        <text
          x="50"
          y="104"
          textAnchor="middle"
          fontSize="6.5"
          fontFamily="'Cinzel', serif"
          fontWeight="600"
          fill="var(--card-ink)"
          letterSpacing="0.06em"
          data-testid="name-band"
        >
          {name}
        </text>

        {/* Flavour lines — decorative placeholder text lines */}
        <g opacity="0.5">
          <rect x="12" y="113" width="76" height="1.4" fill="var(--card-ink)" />
          <rect x="12" y="117" width="60" height="1.4" fill="var(--card-ink)" />
          <rect x="12" y="121" width="70" height="1.4" fill="var(--card-ink)" />
          <rect x="12" y="125" width="48" height="1.4" fill="var(--card-ink)" />
        </g>

        {/* Missing overlay — diagonal hatch + semi-transparent veil.
            Communicates "not in collection", NOT an error state (R48). */}
        {missing && (
          <g data-testid="missing-overlay">
            <rect
              x="2"
              y="2"
              width="96"
              height="136"
              rx="5"
              ry="5"
              fill={`url(#ra-hatch-${size})`}
              opacity="0.7"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
