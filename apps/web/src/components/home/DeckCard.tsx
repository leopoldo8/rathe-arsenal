import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ITrackedDeckListItem, IRepresentativeCard } from '../../api/decks';
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
 * Idle composition (closed state):
 *  - Face-on rectangular deckbox with a subtle right-edge slope and the
 *    bottom-right diagonal corner from the brand's deckbox vocabulary.
 *  - Lid sits flat across the top, hinging at its back edge.
 *  - Hero card is the static centerpiece, framed inside the box.
 *  - Brass `.ra-readiness-display` percent (Cinzel Decorative 900) sits
 *    in the meta strip below. RESERVED class (R7).
 *
 * Hover/focus animation:
 *  - The lid rotates open backward via 3D rotateX (true hinge motion,
 *    not a translate). transform-origin is the back edge.
 *  - Three representative cards rise vertically from behind the hero,
 *    all at the same X position. Back rises highest, then middle, then
 *    front — depth-staggered to feel like a fan opening.
 *  - Hero is the anchor and does not move.
 *  - prefers-reduced-motion path swaps the rotation/translation for
 *    opacity-only fades. Final visible state mirrors the open look.
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

  // Pad representativeCards out to length 3 — missing slots get default
  // oxblood card-back silhouettes so the hover effect always plays.
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

      {/* Untrack — the only persistent action. The whole tile is a
          Link to the deck detail, so a "View" CTA is redundant. On
          hover-capable devices the action stays hidden until the
          tile is hovered or focused; on touch devices (no hover)
          it is always visible. */}
      <button
        type="button"
        className={styles.untrackButton}
        onClick={handleUntrack}
        disabled={isUntracking}
        aria-label={`Untrack ${deck.name}`}
      >
        {isUntracking ? 'Untracking…' : 'Untrack'}
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// DeckBoxVessel — the box body + lid + cards + hero
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
    >
     <div className={styles.vesselTilt}>

      {/* Box body — true 3D perspective drawn in SVG.
          - Front face: big rectangle with bottom-right diagonal
          - Top face (rim): trapezoid above the front, narrower at the
            back to convey looking-down perspective
          - Right side: thin angled strip showing depth
          The whole thing reads as a card box on a table viewed from
          standing height — without relying on CSS rotateX of a flat
          rectangle. */}
      {/* Back layer — rim trapezoid + lid. Drawn BEHIND the cards
          layer so when cards rise they pass over the rim opening, but
          BEHIND the front-face layer so they emerge naturally from
          inside the box. */}
      <svg
        className={styles.vesselBack}
        viewBox="0 0 200 240"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="vsl-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#080202" />
            <stop offset="100%" stopColor="#1a0606" />
          </linearGradient>
          <linearGradient id="vsl-lid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a1a1a" />
            <stop offset="100%" stopColor="#3a0f0f" />
          </linearGradient>
        </defs>

        {/* Top rim trapezoid — dark inside-of-box. Box width is
            tightened so the front face is just barely wider than a
            single card sitting inside, like a real card box. Front
            edge of the rim aligns with the front face top below.
            Back edge inset slightly for the looking-down perspective. */}
        <path
          d="M55 32 L 145 32 L 158 58 L 42 58 Z"
          fill="url(#vsl-rim)"
          stroke="#d69e2e"
          strokeWidth="0.9"
        />

        {/* Closed lid — same trapezoid as rim, different fill. On
            hover the group rotates -90deg around its back edge,
            standing exactly vertical to fully reveal the rim beneath. */}
        <g className={styles.deckBoxLid}>
          <path
            d="M55 32 L 145 32 L 158 58 L 42 58 Z"
            fill="url(#vsl-lid)"
            stroke="#d69e2e"
            strokeWidth="1.1"
          />
          <path
            d="M62 38 L 138 38 L 150 56 L 50 56 Z"
            fill="none"
            stroke="#d69e2e"
            strokeWidth="0.4"
            opacity="0.45"
          />
        </g>
      </svg>

      {/* Cards layer — stacked at same X behind the hero. Idle they
          are tucked inside the box (opacity 0). On hover they rise
          vertically with depth-staggered translateY. Sits BETWEEN
          the back SVG (rim+lid) and the front SVG so cards emerge
          from inside the box, in front of the rim, behind the front
          face. */}
      <div className={styles.deckBoxCardsLayer} aria-hidden="true">
        {slots.map((card, index) => (
          <DeckBoxCard
            key={card?.cardIdentifier ?? `slot-${index}`}
            card={card}
            className={SLOT_CLASSES[index] as string}
          />
        ))}
      </div>

      {/* Front layer — front face + inner brass frame. Sits IN FRONT
          of the cards so cards rising from inside the box emerge
          through the open rim above, hidden by this face below. */}
      <svg
        className={styles.vesselFront}
        viewBox="0 0 200 240"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="vsl-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a1a1a" />
            <stop offset="55%" stopColor="#3a0f0f" />
            <stop offset="100%" stopColor="#220505" />
          </linearGradient>
        </defs>

        {/* Front face — narrow rectangle aligned with the front edge
            of the rim trapezoid above. Width 116 SVG units (x=42 to
            x=158) — barely wider than a single card thumbnail (50% of
            viewBox = 100 SVG units), like a real card box where the
            cards sit snugly inside. */}
        <path
          d="M42 58 L 158 58 L 158 222 L 42 222 Z"
          fill="url(#vsl-front)"
          stroke="#d69e2e"
          strokeWidth="1.4"
        />

        {/* Inner brass frame on the front face — decorative panel. */}
        <path
          d="M48 64 L 152 64 L 152 216 L 48 216 Z"
          fill="none"
          stroke="#d69e2e"
          strokeWidth="0.6"
          opacity="0.55"
        />
      </svg>

      {/* Hero centerpiece — static, centered, in front of cards. */}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeckBoxCard — single card slot
// ---------------------------------------------------------------------------

interface IDeckBoxCardProps {
  readonly card: IRepresentativeCard | null;
  readonly className: string;
}

function DeckBoxCard({ card, className }: IDeckBoxCardProps): React.ReactElement {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage =
    card?.imageUrl?.small !== undefined &&
    card.imageUrl.small.length > 0 &&
    !imageFailed;

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
        <div className={styles.deckBoxCardSilhouette}>
          <span className={styles.deckBoxCardCrest}>&#9670;</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroImage — onError fallback wrapper
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
