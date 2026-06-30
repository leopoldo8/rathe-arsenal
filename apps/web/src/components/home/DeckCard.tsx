import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ITrackedDeckListItem, IRepresentativeCard } from '../../api/decks';
import { StatusBullet, STATUS_KEY_MAP } from '../deck-detail/StatusBullet';
import styles from './DeckCard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDeckCardProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
  /**
   * Currently active tag filter chips on the home page. When non-empty,
   * any matching tag is promoted to the visible 4 tag chip slots so the
   * filter context is always visible on the card.
   */
  readonly activeFilterTags?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG_VISIBLE_LIMIT = 4;

function resolveReadinessTier(effectivePercent: number): 'high' | 'mid' | 'low' {
  if (effectivePercent >= 80) return 'high';
  if (effectivePercent >= 50) return 'mid';
  return 'low';
}

/**
 * Builds the list of up to TAG_VISIBLE_LIMIT tags to show on the card.
 * Active filter tags are promoted to the front so they are always visible,
 * regardless of their position in the deck's tag list (R7).
 *
 * Returns { visible: string[], overflow: number } where `overflow` is the
 * count of additional tags not shown.
 */
function resolveVisibleTags(
  tags: readonly string[],
  activeFilterTags: readonly string[],
): { readonly visible: readonly string[]; readonly overflow: number } {
  if (tags.length === 0) return { visible: [], overflow: 0 };

  // Partition tags: active-filter matches first, then the rest
  const active: string[] = [];
  const rest: string[] = [];
  for (const tag of tags) {
    if (activeFilterTags.includes(tag)) {
      active.push(tag);
    } else {
      rest.push(tag);
    }
  }

  const ordered = [...active, ...rest];
  const visible = ordered.slice(0, TAG_VISIBLE_LIMIT);
  const overflow = ordered.length - visible.length;
  return { visible, overflow };
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
export function DeckCard({
  deck,
  onUntrack,
  isUntracking,
  activeFilterTags = [],
}: IDeckCardProps): React.ReactElement {
  const { t } = useTranslation();
  const effectivePercent = deck.latestSnapshot?.effectivePercent ?? null;
  const tier = effectivePercent !== null ? resolveReadinessTier(effectivePercent) : null;

  function handleUntrack(): void {
    const confirmed = window.confirm(
      t('home.untrackConfirmMsg', { deckName: deck.name }),
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

  const { visible: visibleTags, overflow: tagOverflow } = resolveVisibleTags(
    deck.tags,
    activeFilterTags,
  );

  // Legality icon: 2-state mapping per R26.
  // 'legal' → ✓, 'incomplete' | 'illegal' → ✗.
  const legalityCategory = deck.legality.category;
  const isLegal = legalityCategory === 'legal';

  return (
    <article className={cardClasses} aria-label={deck.name}>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(deck.id) }}
        search={{ edit: undefined }}
        className={styles.cardLink}
      >
        <DeckBoxVessel
          heroSources={resolveSources(deck.heroImageUrl)}
          heroAlt={deck.hero}
          slots={slots}
          tier={tier}
          deckName={deck.name}
          percent={effectivePercent}
        />

        {/* Visually-hidden h3 — keeps the deck name in the document
            outline for assistive tech (the in-box label is decorative
            in the a11y tree). The hero name + format are conveyed by
            the hero art and the deck title inside the box, so they
            are not duplicated in visible text below. */}
        <h3 className={styles.srOnlyTitle}>
          {deck.name} — {deck.hero}, {deck.format}
        </h3>

        {/* Status row — StatusBullet dot + label below deck name.
            Small caps styling via CSS. */}
        <div className={styles.statusRow}>
          <StatusBullet status={deck.status} showLabel={false} />
          <span className={styles.statusLabel}>{t(STATUS_KEY_MAP[deck.status])}</span>
        </div>

        {/* Format pill + legality icon (2-state: ✓ legal / ✗ incomplete or illegal) */}
        <div className={styles.metaRow}>
          <span className={styles.formatPill}>{deck.format}</span>
          <span
            className={`${styles.legalityIcon} ${isLegal ? styles.legalityLegal : styles.legalityIllegal}`}
            aria-label={isLegal ? t('home.legalityLegalLabel') : t('home.legalityNotLegalLabel')}
            title={isLegal ? t('home.legalityLegalTitle') : legalityCategory === 'incomplete' ? t('home.legalityIncompleteTitle') : t('home.legalityIllegalTitle')}
          >
            {isLegal ? '✓' : '✗'}
          </span>
        </div>

        {/* Tag chips — soft cap of 4 visible + +N overflow.
            Active filter tags are promoted to the front so they are
            always visible in the card (R7). */}
        {visibleTags.length > 0 && (
          <div className={styles.tagRow} aria-label={t('home.tagsRowLabel')}>
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className={`${styles.tagChip} ${activeFilterTags.includes(tag) ? styles.tagChipActive : ''}`}
              >
                {tag}
              </span>
            ))}
            {tagOverflow > 0 && (
              <span className={styles.tagOverflow} aria-label={t('home.moreTagsAriaLabel', { count: tagOverflow })}>
                +{tagOverflow}
              </span>
            )}
          </div>
        )}

        {effectivePercent === null && (
          <div className={styles.cardNoReadiness}>{t('home.noReadinessData')}</div>
        )}
      </Link>

      {/* Untrack pin — brass nail/pin glued to the top-right corner of
          the box. Always visible (no :hover gating) so touch devices
          get the action without trickery. The 32×32 visual is padded
          out to a 44×44 tap target. The whole tile is a Link to the
          deck detail; this pin is the only persistent action. */}
      <UntrackPin
        onClick={handleUntrack}
        disabled={isUntracking}
        deckName={deck.name}
      />
    </article>
  );
}

// ---------------------------------------------------------------------------
// DeckBoxVessel — the box body + lid + cards + hero
// ---------------------------------------------------------------------------

interface IDeckBoxVesselProps {
  readonly heroSources: readonly string[] | null;
  readonly heroAlt: string;
  readonly slots: ReadonlyArray<IRepresentativeCard | null>;
  readonly tier: 'high' | 'mid' | 'low' | null;
  readonly deckName: string;
  readonly percent: number | null;
}

function DeckBoxVessel({
  heroSources,
  heroAlt,
  slots,
  tier,
  deckName,
  percent,
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

        {/* Top rim trapezoid — back edge inset for perspective. */}
        <path
          d="M62 32 L 138 32 L 158 58 L 42 58 Z"
          fill="url(#vsl-rim)"
          stroke="currentColor"
          strokeWidth="0.9"
        />

        {/* Closed lid — same trapezoid as rim, different fill. On
            hover this group rotates -90deg via CSS rotateX, standing
            vertical to reveal the rim beneath. */}
        <g className={styles.deckBoxLid}>
          <path
            d="M62 32 L 138 32 L 158 58 L 42 58 Z"
            fill="url(#vsl-lid)"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          {/* Inner brass detail — proportional inset trapezoid.
              Calculated as a 0.84x scale from the outer trapezoid
              about its centroid (100, 45). This guarantees each
              inner side is parallel to its corresponding outer side
              (same slope, same direction) — earlier the inner sides
              had a different slope from the outer sides, which made
              the detail line look misaligned with the lid corners. */}
          <path
            d="M68 34 L 132 34 L 149 56 L 51 56 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
            opacity="0.45"
          />
          {/* Brand R emblem — UnifrakturCook fraktur, brass. Reserved
              treatment from the logo-mark, applied here as the deckbox's
              "branding stamp". When the lid hinges open the R rotates
              with it (physical lid behavior). */}
          <text
            x="100"
            y="53"
            textAnchor="middle"
            fontFamily="UnifrakturCook, serif"
            fontWeight="700"
            fontSize="20"
            fill="currentColor"
          >
            R
          </text>
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
          stroke="currentColor"
          strokeWidth="1.4"
        />

        {/* Inner brass frame on the front face — decorative panel. */}
        <path
          d="M48 64 L 152 64 L 152 216 L 48 216 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.55"
        />
      </svg>

      {/* Hero centerpiece — static, centered, in front of cards. */}
      <div className={styles.deckBoxHeroSlot}>
        {heroSources && heroSources.length > 0 ? (
          <HeroImage sources={heroSources} alt={heroAlt} />
        ) : (
          <div className={styles.deckBoxHeroFallback} aria-hidden="true">
            <span className={styles.deckBoxHeroSigil}>&#9670;</span>
          </div>
        )}
      </div>

      {/* Deck name printed on the box — sits at the bottom of the
          front face like a label on a real card box. Truncates with
          ellipsis when the name doesn't fit on one line. */}
      <div className={styles.deckBoxTitle} title={deckName}>
        {deckName}
      </div>

      {/* Hero life token — small octagonal life-counter pinned to the
          bottom-right of the box's front face, inside the brass frame.
          Reads as a FaB life token sitting on/in the deckbox, not as
          a label appended below it. Hidden when no snapshot has been
          computed yet — the box itself still reads as a deck. */}
      {percent !== null && tier !== null && (
        <HeroLifeToken percent={percent} tier={tier} />
      )}
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
  const sources = resolveSources(card?.imageUrl ?? null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const exhausted = sources === null || sourceIndex >= sources.length;

  return (
    <div className={`${styles.deckBoxCard} ${className}`}>
      {!exhausted ? (
        <img
          src={sources![sourceIndex]}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.deckBoxCardImage}
          onError={() => setSourceIndex((i) => i + 1)}
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
// HeroLifeToken — readiness rendered as a FaB-style hero life token
// ---------------------------------------------------------------------------

interface IHeroLifeTokenProps {
  readonly percent: number;
  readonly tier: 'high' | 'mid' | 'low';
}

/**
 * Three concentric octagons mirror the anatomy of a Flesh and Blood
 * hero life token: an outer status halo (tier-colored), a brass border,
 * and an oxblood-deep center. The cream numeral inside reads as the
 * hero's life total. Percentage is rounded to an integer (tokens are
 * for at-a-glance reading); precision lives on the deck detail page.
 *
 * Tier is encoded in the OUTER ring rather than the center so the token
 * stays recognizably "FaB life token" (red+brass) and the ring acts as
 * a status halo. The numeric text keeps the brand `.ra-readiness-display`
 * class for typographic continuity.
 */
function HeroLifeToken({ percent, tier }: IHeroLifeTokenProps): React.ReactElement {
  const { t } = useTranslation();
  const display = Math.round(Math.max(0, Math.min(100, percent)));
  const tierClass = styles[`heroLifeToken--${tier}`] ?? '';
  return (
    <div
      className={`${styles.heroLifeToken} ${tierClass}`}
      role="meter"
      aria-label={t('home.readinessMeterAriaLabel', { display, tier })}
      aria-valuenow={display}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="lt-brass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8c878" />
            <stop offset="50%" stopColor="#b8860b" />
            <stop offset="100%" stopColor="#5a3a08" />
          </linearGradient>
          <radialGradient id="lt-center" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#7a2222" />
            <stop offset="65%" stopColor="#4a1313" />
            <stop offset="100%" stopColor="#2a0808" />
          </radialGradient>
        </defs>
        {/* Outer tier ring — status halo. */}
        <path
          d="M 29.3 0 L 70.7 0 L 100 29.3 L 100 70.7 L 70.7 100 L 29.3 100 L 0 70.7 L 0 29.3 Z"
          className={styles.lifeTokenRing}
        />
        {/* Brass border — metallic gradient. */}
        <path
          d="M 32 4 L 68 4 L 96 32 L 96 68 L 68 96 L 32 96 L 4 68 L 4 32 Z"
          fill="url(#lt-brass)"
        />
        {/* Inner brass detail line — proportional inset for embossing. */}
        <path
          d="M 34 7 L 66 7 L 93 34 L 93 66 L 66 93 L 34 93 L 7 66 L 7 34 Z"
          fill="none"
          stroke="rgba(0, 0, 0, 0.4)"
          strokeWidth="0.6"
        />
        {/* Oxblood center — deep red, the FaB life-token signature color. */}
        <path
          d="M 36 9 L 64 9 L 91 36 L 91 64 L 64 91 L 36 91 L 9 64 L 9 36 Z"
          fill="url(#lt-center)"
        />
        {/* Inner brass beveled rim — narrow gold line just inside the center. */}
        <path
          d="M 38 12 L 62 12 L 88 38 L 88 62 L 62 88 L 38 88 L 12 62 L 12 38 Z"
          fill="none"
          stroke="#b8860b"
          strokeWidth="0.8"
          opacity="0.55"
        />
        {/* Two stacked text elements, both centered on x=50, so the
            number sits above and the % sits below the same vertical
            axis. The numeral is the focal element; the % reads as a
            unit label below it. */}
        <text
          x="50"
          y="48"
          textAnchor="middle"
          dominantBaseline="middle"
          className={`${styles.lifeTokenNumber} ra-readiness-display`}
        >
          {display}
        </text>
        <text
          x="50"
          y="72"
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.lifeTokenPercent}
        >
          %
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UntrackPin — brass corner pin that removes the deck from tracking
// ---------------------------------------------------------------------------

interface IUntrackPinProps {
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly deckName: string;
}

function UntrackPin({ onClick, disabled, deckName }: IUntrackPinProps): React.ReactElement {
  const { t } = useTranslation();
  // The pin is split into two co-located elements:
  //  - .untrackPinVisual (z-index: 1, aria-hidden, pointer-events: none):
  //    sits BEHIND the deckbox so the box visually covers it during the
  //    slide-in animation. This is the "from behind" visual.
  //  - .untrackPinHit (z-index: 3, the actual button): sits ABOVE the
  //    deckbox at the final hover position. Invisible; only catches
  //    clicks. pointer-events flips to auto on tile hover.
  //
  // Splitting solves the conflict between "box must cover the pin
  // during animation" (requires z < cardLink) and "click must register"
  // (requires z > cardLink). One layer per concern.
  return (
    <>
      <span className={styles.untrackPinVisual} aria-hidden="true">
        <svg
          className={styles.untrackPinIcon}
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path d="M5 6 H 19" />
          <path d="M9 4 H 15 V 6" />
          <path d="M7 6 L 8 20 H 16 L 17 6" />
          <path d="M11 10 V 17 M 13 10 V 17" />
        </svg>
      </span>
      <button
        type="button"
        className={styles.untrackPinHit}
        onClick={onClick}
        disabled={disabled}
        aria-label={t('home.untrackAriaLabel', { deckName })}
        aria-busy={disabled}
        title={t('home.untrackTitle')}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// HeroImage — onError fallback wrapper
// ---------------------------------------------------------------------------

interface IHeroImageProps {
  readonly sources: readonly string[];
  readonly alt: string;
}

/**
 * Walks the catalog's ordered URL list on `<img onError>`. Legend Story's
 * CDN 403's some primary card assets — most heroes have working `-RF`
 * (rainbow foil) or `HER###-RF` reprint URLs as fallbacks even when the
 * canonical set/number 404's. When all sources fail, falls back to the
 * stylized sigil placeholder.
 */
function HeroImage({ sources, alt }: IHeroImageProps): React.ReactElement {
  const [sourceIndex, setSourceIndex] = useState(0);
  if (sourceIndex >= sources.length) {
    return (
      <div className={styles.deckBoxHeroFallback}>
        <span className={styles.deckBoxHeroSigil}>&#9670;</span>
      </div>
    );
  }
  return (
    <img
      src={sources[sourceIndex]}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={styles.deckBoxHeroImage}
      onError={() => setSourceIndex((i) => i + 1)}
    />
  );
}

/**
 * Normalises an `imageUrl` payload into the ordered list of small URLs
 * to try. Returns null when no usable URL exists. Also tolerates legacy
 * payloads (pre-fix) that lack `smallSources` — falls back to a single-
 * element list with just `small`.
 */
function resolveSources(
  imageUrl: { readonly small: string; readonly smallSources?: readonly string[] } | null,
): readonly string[] | null {
  if (!imageUrl || !imageUrl.small) return null;
  if (imageUrl.smallSources && imageUrl.smallSources.length > 0) {
    return imageUrl.smallSources;
  }
  return [imageUrl.small];
}
