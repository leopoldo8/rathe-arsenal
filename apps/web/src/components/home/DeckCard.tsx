import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ITrackedDeckListItem, IRepresentativeCard } from '../../api/decks';
import { Button } from '../ui/Button/Button';
import styles from './DeckCard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDeckCardProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveReadinessTier(effectivePercent: number): 'high' | 'mid' | 'low' {
  if (effectivePercent >= 80) return 'high';
  if (effectivePercent >= 50) return 'mid';
  return 'low';
}

// Card slot index: back lifts the most, front lifts the least. Drives
// the hover-open animation: each slot has its own translateY + delay
// in the CSS module so the cards fan upward when the deckbox opens.
const SLOT_CLASSES = [
  styles.deckBoxCardBack,
  styles.deckBoxCardMiddle,
  styles.deckBoxCardFront,
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DeckCard — home readiness shelf card, rendered as a deckbox vessel.
 *
 * Static composition:
 *  - The deckbox SVG (oxblood gradient + brass detail) reuses the
 *    isometric geometry from `assets/logo-mark.svg` and the design
 *    prototype `docs/design/v1/shell.jsx`. The bottom-right diagonal
 *    fix (PR #57) lives in both sources.
 *  - The hero card thumbnail is the static centerpiece — sourced from
 *    the snapshot's slot=hero entry and projected as `heroImageUrl`.
 *  - The brass `.ra-readiness-display` percent (Cinzel Decorative 900)
 *    sits below the hero. RESERVED class (R7).
 *
 * Hover/focus animation:
 *  - Deckbox perspective is immutable — only the lid translates upward
 *    and three representative cards fan out from inside.
 *  - The back card lifts the most (-22px); middle (-14px); front (-6px).
 *    Stagger via CSS transition-delay creates a "fan opening" cascade.
 *  - All movement uses transform + opacity (GPU-only). The
 *    prefers-reduced-motion path swaps translation for opacity-only
 *    fades.
 *  - When the snapshot has fewer than 3 mainboard entries (e.g. just-
 *    tracked deck without a snapshot, or a hero-only deck), the missing
 *    slots fall back to neutral oxblood card-back silhouettes so the
 *    animation still plays.
 */
export function DeckCard({ deck, onUntrack, isUntracking }: IDeckCardProps): React.ReactElement {
  const effectivePercent = deck.latestSnapshot?.effectivePercent ?? null;
  const tier = effectivePercent !== null ? resolveReadinessTier(effectivePercent) : null;

  function handleUntrack(): void {
    const confirmed = window.confirm(
      `Untrack "${deck.name}"? This will remove the deck and all its readiness data.`,
    );
    if (confirmed) {
      onUntrack(deck.id);
    }
  }

  const cardClasses = [
    styles.card,
    tier !== null ? styles[`card--${tier}`] : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Pad the representativeCards list out to length 3 so the hover
  // animation always has three slots. Missing slots render as silhouettes.
  const slots: ReadonlyArray<IRepresentativeCard | null> = [
    deck.representativeCards[0] ?? null,
    deck.representativeCards[1] ?? null,
    deck.representativeCards[2] ?? null,
  ];

  return (
    <article className={cardClasses} aria-label={deck.name}>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(deck.id) }}
        className={styles.cardLink}
      >
        <DeckBoxVessel
          heroImageUrl={deck.heroImageUrl?.small ?? null}
          heroAlt={deck.hero}
          slots={slots}
          tier={tier}
        />

        <div className={styles.cardTextRow}>
          <h3 className={styles.cardName}>{deck.name}</h3>
          <p className={styles.cardMeta}>
            {deck.hero} <span className={styles.cardMetaSep} aria-hidden="true">&middot;</span> {deck.format}
          </p>
        </div>

        {effectivePercent !== null ? (
          <div className={styles.cardReadiness}>
            <span className={`${styles.readinessDisplay} ra-readiness-display`}>
              {effectivePercent.toFixed(1)}%
            </span>
            <span className={styles.readinessLabel}>ready</span>
          </div>
        ) : (
          <div className={styles.cardNoReadiness}>No readiness data yet</div>
        )}
      </Link>

      <div className={styles.cardFooter}>
        {/* Wide layout (≥640px): side-by-side actions */}
        <div className={styles.actionsWide}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(deck.id) }}
            className={styles.viewLink}
          >
            <Button variant="primary" size="sm">
              View
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={handleUntrack}
            loading={isUntracking}
            disabled={isUntracking}
          >
            Untrack
          </Button>
        </div>

        {/* Narrow layout (<640px): View full-width, Untrack in overflow */}
        <div className={styles.actionsNarrow}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(deck.id) }}
            className={styles.viewLinkFull}
          >
            <Button variant="primary" size="sm" className={styles.viewButtonFull}>
              View deck
            </Button>
          </Link>
          <details className={styles.overflowMenu}>
            <summary className={styles.overflowTrigger} aria-label="More actions">
              &hellip;
            </summary>
            <div className={styles.overflowContent}>
              <Button
                variant="danger"
                size="sm"
                onClick={handleUntrack}
                loading={isUntracking}
                disabled={isUntracking}
              >
                Untrack deck
              </Button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// DeckBoxVessel — the SVG container + HTML overlays
// ---------------------------------------------------------------------------

interface IDeckBoxVesselProps {
  readonly heroImageUrl: string | null;
  readonly heroAlt: string;
  readonly slots: ReadonlyArray<IRepresentativeCard | null>;
  readonly tier: 'high' | 'mid' | 'low' | null;
}

function DeckBoxVessel({
  heroImageUrl,
  heroAlt,
  slots,
  tier,
}: IDeckBoxVesselProps): React.ReactElement {
  return (
    <div
      className={[
        styles.vesselWrap,
        tier ? styles[`vesselWrap--${tier}`] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="false"
    >
      {/* Outer SVG carries the box body + side + lid. The geometry
          mirrors logo-mark.svg (PR #57 isometric-bottom fix preserved).
          ViewBox is widened to give the cards horizontal headroom on
          hover; the box itself sits inside the original 24-72 / 24-96
          coordinate window. */}
      <svg
        className={styles.vesselSvg}
        viewBox="0 0 96 108"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="vsl-box-front" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a2222" />
            <stop offset="60%" stopColor="#5a1a1a" />
            <stop offset="100%" stopColor="#3a0f0f" />
          </linearGradient>
          <linearGradient id="vsl-box-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3a0f0f" />
            <stop offset="100%" stopColor="#2a0808" />
          </linearGradient>
          <linearGradient id="vsl-lid-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a2222" />
            <stop offset="100%" stopColor="#4a1414" />
          </linearGradient>
        </defs>

        {/* Box back face — flat oxblood with brass hairline */}
        <path
          d="M36 28 L 72 24 L 72 88 L 36 96 Z"
          fill="#3a0f0f"
          stroke="#d69e2e"
          strokeWidth="0.6"
        />
        {/* Box side face */}
        <path
          d="M60 32 L 72 24 L 72 88 L 60 96 Z"
          fill="url(#vsl-box-side)"
          stroke="#d69e2e"
          strokeWidth="0.8"
        />
        {/* Box front face */}
        <path
          d="M24 36 L 60 32 L 60 96 L 24 96 Z"
          fill="url(#vsl-box-front)"
          stroke="#d69e2e"
          strokeWidth="1"
        />
        {/* Decorative inner brass border on front face */}
        <path
          d="M27 41 L 57 37 L 57 92 L 27 92 Z"
          fill="none"
          stroke="#d69e2e"
          strokeWidth="0.5"
          opacity="0.75"
        />

        {/* Lid — translates upward on hover. transform-origin sits at
            the back-edge of the lid so the lift reads as the box opening
            from the back, not floating off vertically. */}
        <g className={styles.deckBoxLid}>
          <path
            d="M36 28 L 72 24 L 78 12 L 42 16 Z"
            fill="#3a0f0f"
            stroke="#d69e2e"
            strokeWidth="0.8"
          />
          <path
            d="M42 16 L 78 12 L 78 6 L 42 10 Z"
            fill="url(#vsl-lid-top)"
            stroke="#d69e2e"
            strokeWidth="0.8"
          />
          <path
            d="M38.5 26.5 L 70.5 23 L 75 14 L 44 17.5 Z"
            fill="none"
            stroke="#d69e2e"
            strokeWidth="0.35"
            opacity="0.55"
          />
        </g>

        {/* Box rim — sits in front of the lid in z-order so when the
            lid lifts, the rim is what the cards fan out from. */}
        <path
          d="M24 36 L 60 32 L 72 24 L 36 28 Z"
          fill="#120303"
          stroke="#d69e2e"
          strokeWidth="0.9"
        />
        <path
          d="M27 35.2 L 58 31.5 L 69 24.9 L 38 28.6 Z"
          fill="none"
          stroke="#d69e2e"
          strokeWidth="0.3"
          opacity="0.55"
        />
      </svg>

      {/* Cards layer — three slot positions stacked inside the box.
          At idle they sit clipped behind the rim with reduced opacity.
          On hover/focus they fan upward with depth-staggered timing.
          Real card images for slots populated by representativeCards;
          silhouette fallbacks for any empty slot. */}
      <div className={styles.deckBoxCardsLayer} aria-hidden="true">
        {slots.map((card, index) => (
          <DeckBoxCard
            key={card?.cardIdentifier ?? `slot-${index}`}
            card={card}
            className={SLOT_CLASSES[index] as string}
          />
        ))}
      </div>

      {/* Hero centerpiece — static anchor that does NOT move on hover.
          Sits in front of (z-index above) the lifting cards so it always
          reads as the deck's identity. */}
      <div className={styles.deckBoxHeroSlot}>
        {heroImageUrl ? (
          <HeroImage src={heroImageUrl} alt={heroAlt} />
        ) : (
          <div className={styles.deckBoxHeroFallback} aria-hidden="true">
            <span className={styles.deckBoxHeroSigil}>&#9670;</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeckBoxCard — single card slot (real image or silhouette fallback)
// ---------------------------------------------------------------------------

interface IDeckBoxCardProps {
  readonly card: IRepresentativeCard | null;
  readonly className: string;
}

function DeckBoxCard({ card, className }: IDeckBoxCardProps): React.ReactElement {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage =
    card?.imageUrl?.small !== undefined && card.imageUrl.small.length > 0 && !imageFailed;

  return (
    <div className={`${styles.deckBoxCard} ${className}`}>
      {showImage ? (
        <img
          src={card!.imageUrl!.small}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.deckBoxCardImage}
          onError={() => setImageFailed(true)}
        />
      ) : (
        // Default-fill silhouette: oxblood backdrop + brass diamond crest.
        // Used when the deck has no snapshot yet, the catalog has no
        // image for the card, or the image URL fails to load.
        <div className={styles.deckBoxCardSilhouette}>
          <span className={styles.deckBoxCardCrest}>&#9670;</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroImage — small wrapper with onError fallback
// ---------------------------------------------------------------------------

interface IHeroImageProps {
  readonly src: string;
  readonly alt: string;
}

function HeroImage({ src, alt }: IHeroImageProps): React.ReactElement {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={styles.deckBoxHeroFallback}>
        <span className={styles.deckBoxHeroSigil}>&#9670;</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={styles.deckBoxHeroImage}
      onError={() => setFailed(true)}
    />
  );
}
