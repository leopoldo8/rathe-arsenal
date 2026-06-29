import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  /**
   * Optional pixel width override. When provided, the size preset is ignored
   * for sizing (height derived from the same 7:10 aspect ratio). Used by the
   * library grid's continuous size slider so users can scale cells beyond the
   * 4 fixed presets.
   */
  readonly widthOverride?: number | undefined;
  /**
   * Public image URLs (WebP small/large) from the LSS S3 bucket. When
   * `sources` is provided, the component cycles through each candidate
   * on `<img onError>` until one loads or the list is exhausted (the SVG
   * fallback then renders). `small`/`large` mirror the first source for
   * legacy callers; new code should rely on `sources`. null means the
   * source catalog has no image code at all.
   */
  readonly imageUrl?:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources?: readonly {
          readonly small: string;
          readonly large: string;
        }[];
      }
    | null
    | undefined;
  /**
   * When provided, wraps the card in a button so the user can click to
   * open a fullscreen lightbox view. The parent owns the lightbox state;
   * CardArt just emits the click.
   */
  readonly onClick?: (() => void) | undefined;
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
  type: string | null | undefined,
): React.FC<React.SVGProps<SVGSVGElement>> {
  // Defensive: pre-U11 snapshots persisted before IBreakdownEntry enrichment
  // may carry a missing `type` field. Fall back to the deckbox glyph instead
  // of crashing on `undefined.trim()`. Next auto-recompute writes the enriched
  // shape and the fallback clears on its own.
  if (!type) return DeckboxGlyph;
  const normalized = type.trim().toLowerCase();
  return TYPE_GLYPH_MAP[normalized] ?? DeckboxGlyph;
}

function resolvePitchKey(pitch: 1 | 2 | 3 | null | undefined): string {
  // Defensive: pre-U11 snapshots may carry pitch=undefined or unexpected
  // numeric values. Anything outside {1,2,3} falls back to the colorless
  // palette so lookup into PITCH_FRAME_VARS always hits a defined entry.
  if (pitch === 1 || pitch === 2 || pitch === 3) return String(pitch);
  return 'colorless';
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
  imageUrl,
  onClick,
  widthOverride,
}: ICardArtProps): React.ReactElement {
  const { t } = useTranslation();
  const width = widthOverride ?? SIZE_WIDTH_MAP[size];
  const height = Math.round(width * ASPECT_RATIO);

  // Ordered candidate list — the bare `defaultImage` URL plus any foiled
  // variants (`-RF`/`-CF`/`-GF`). Older shape callers without `sources`
  // get a single-entry list synthesised from `small`/`large` so the
  // cycling logic still applies uniformly.
  const sources = imageUrl
    ? imageUrl.sources && imageUrl.sources.length > 0
      ? imageUrl.sources
      : [{ small: imageUrl.small, large: imageUrl.large }]
    : [];

  // Index of the currently-attempted candidate. Advances on each `<img
  // onError>`; once it equals `sources.length`, every candidate has 404'd
  // and the SVG fallback takes over.
  const [sourceIndex, setSourceIndex] = useState(0);
  const currentSource = sources[sourceIndex];
  const imageErrored = sources.length === 0 || sourceIndex >= sources.length;
  const hasImage = Boolean(currentSource && !imageErrored);

  // React 18 stable id — unique per component instance across renders.
  // Without this, rendering N `missing` cards of the same size produces N
  // duplicate `id="ra-hatch-md"` elements; browsers resolve `url(#…)` to the
  // first match, masking any future per-instance divergence of pattern attrs.
  const reactId = useId();
  const hatchId = `ra-hatch-${reactId}`;

  const pitchKey = resolvePitchKey(pitch);

  const TypeGlyphComponent = resolveGlyph(type);

  // When widthOverride is set, apply dimensions directly to the container
  // via a ref — this avoids the style prop in JSX while keeping the
  // precise pixel sizing needed for the library grid size slider.
  const containerRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (widthOverride !== undefined) {
      el.style.width = `${widthOverride}px`;
      el.style.height = `${height}px`;
    } else {
      el.style.width = '';
      el.style.height = '';
    }
  }, [widthOverride, height]);

  const containerClass = [
    styles.cardArt,
    styles[`cardArt--${size}`],
    missing ? styles['cardArt--missing'] : '',
    hasImage ? styles['cardArt--withImage'] : '',
    onClick ? styles['cardArt--clickable'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Pitch key as a data attribute value for CSS Module selectors.
  // 'colorless' matches the default CSS vars on .cardArt; numbered values
  // match the [data-pitch='1'/'2'/'3'] selectors in the module.
  const dataPitch = pitchKey === 'colorless' ? undefined : pitchKey;

  const inner = (
    <>
      {/* Real card image overlay — sits above the SVG placeholder. The
          SVG still renders beneath so a slow-loading image briefly shows
          the stylized frame instead of a blank rectangle.
          The image uses width/height 100% from the module CSS; when
          widthOverride is set the container is sized by the ref effect
          and the image fills it via position:absolute + inset:0. */}
      {currentSource && !imageErrored && (
        <img
          // `key` forces a fresh <img> when the URL changes, so the next
          // candidate runs through the load → error lifecycle even if the
          // previous one's onError already fired in the same tick.
          key={currentSource.small}
          src={currentSource.small}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={styles.cardArtImage}
          onError={() => setSourceIndex((i) => i + 1)}
          data-testid="card-art-image"
        />
      )}
      {/* Missing hatch overlay for `imageUrl` path — replicates the SVG
          pattern as CSS so it sits above the <img>. For the SVG-only
          path the overlay is drawn inside the <svg>. */}
      {hasImage && missing && (
        <span
          className={styles.cardArtHatch}
          data-testid="missing-overlay-image"
          aria-hidden="true"
        />
      )}
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
              id={hatchId}
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

        {/* Type glyph — scaled into the art panel.
            The typeGlyph class sets color: var(--card-sym) so the glyph
            component's fill: currentColor picks up the pitch-derived sym color
            from the container's data-pitch CSS variable selectors. */}
        <g
          transform="translate(10 22) scale(0.8 0.8)"
          className={styles.typeGlyph}
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
              fill={`url(#${hatchId})`}
              opacity="0.7"
            />
          </g>
        )}
      </svg>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        ref={containerRef as React.RefObject<HTMLButtonElement>}
        className={containerClass}
        data-pitch={dataPitch}
        data-testid="card-art"
        onClick={onClick}
        aria-label={t('ui.openFullscreen', { name })}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={containerClass}
      data-pitch={dataPitch}
      data-testid="card-art"
    >
      {inner}
    </div>
  );
}
