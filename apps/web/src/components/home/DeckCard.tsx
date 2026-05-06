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

      <div className={styles.cardFooter}>
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
      {/* Cards layer — stacked at same X behind the hero. Idle they are
          tucked inside the box (translateY 0, opacity 0). On hover they
          rise vertically with depth-staggered translateY. */}
      <div className={styles.deckBoxCardsLayer} aria-hidden="true">
        {slots.map((card, index) => (
          <DeckBoxCard
            key={card?.cardIdentifier ?? `slot-${index}`}
            card={card}
            className={SLOT_CLASSES[index] as string}
          />
        ))}
      </div>

      {/* Box body — face-on rectangle with bottom-right diagonal cut.
          The geometry is intentionally simpler than the logo-mark
          (no isometric skew); the depth is suggested by a thin right-
          edge strip and the diagonal corner. */}
      <svg
        className={styles.vesselBox}
        viewBox="0 0 200 220"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="vsl-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a1a1a" />
            <stop offset="60%" stopColor="#3a0f0f" />
            <stop offset="100%" stopColor="#2a0808" />
          </linearGradient>
          <linearGradient id="vsl-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3a0f0f" />
            <stop offset="100%" stopColor="#1a0606" />
          </linearGradient>
          <linearGradient id="vsl-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0202" />
            <stop offset="100%" stopColor="#1a0606" />
          </linearGradient>
        </defs>

        {/* Front face — large rectangle with the bottom-right diagonal.
            Bottom-right corner cut at 45° preserves the deckbox vocab
            from PR #57. */}
        <path
          d="M8 30 L 176 30 L 176 196 L 162 210 L 8 210 Z"
          fill="url(#vsl-front)"
          stroke="#d69e2e"
          strokeWidth="1.4"
        />

        {/* Right depth strip — narrow oxblood sliver right of the front
            face. Conveys depth without isometric skew. */}
        <path
          d="M176 30 L 192 36 L 192 200 L 176 196 Z"
          fill="url(#vsl-side)"
          stroke="#d69e2e"
          strokeWidth="1"
        />
        {/* Bottom-right corner of the depth strip — matches the front
            diagonal so the box closes coherently. */}
        <path
          d="M176 196 L 192 200 L 178 214 L 162 210 Z"
          fill="url(#vsl-side)"
          stroke="#d69e2e"
          strokeWidth="1"
        />

        {/* Inner brass border on the front face — decorative frame. */}
        <path
          d="M16 38 L 168 38 L 168 192 L 158 202 L 16 202 Z"
          fill="none"
          stroke="#d69e2e"
          strokeWidth="0.6"
          opacity="0.55"
        />

        {/* Box rim (top inner edge, dark) — the lid sits on this rim
            when closed. Sits behind the lid in z-order so when the lid
            opens we see this dark rim revealed. */}
        <path
          d="M8 30 L 176 30 L 192 36 L 24 36 Z"
          fill="url(#vsl-rim)"
          stroke="#d69e2e"
          strokeWidth="1"
        />
      </svg>

      {/* Lid — separate HTML element so we can apply 3D rotateX.
          Idle: lid lies flat over the rim. Hover: rotates -115deg
          backward around its back-edge hinge. */}
      <div className={styles.deckBoxLid} aria-hidden="true">
        <div className={styles.deckBoxLidFace} />
      </div>

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
