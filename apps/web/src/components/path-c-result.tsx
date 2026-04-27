import { IBreakdown, ISubstitutedEntry } from '../api/deck-detail';
import { IShoppingLineResponse } from '../api/shopping-line';
import { BreakdownList } from './breakdown-list';
import { ShoppingLine } from './ShoppingLine';
import styles from './path-c-result.module.css';

interface IPathCResultProps {
  readonly breakdown: IBreakdown;
  readonly fidelityPercent: number;
  /**
   * Fires when the user clicks "Track proximal version". The parent
   * should call the tracked-deck import flow with `seedInventory: false`.
   * No-op by default so the component stays standalone in Unit 8; Unit 6
   * will wire this up when TestDeckResult integrates Path C.
   */
  readonly onTrackProximalVersion?: () => void;
  /**
   * Optional mark-owned handler forwarded to the embedded BreakdownList.
   * Path C callers that do not want the mark-owned affordance can omit
   * it and the component falls back to a read-only breakdown.
   */
  readonly onMarkOwned?: (cardIdentifier: string) => void;
  readonly isMarkingOwned?: boolean;
  readonly pendingCard?: string | null;
  /** Shopping line data from the API response. Added in Phase 1b. */
  readonly shoppingLine?: IShoppingLineResponse;
}

const MISSING_SECTION_ID = 'path-c-missing-cards';

/**
 * Returns the pitch value as a string suitable for the data-pitch attribute,
 * or undefined (renders no attribute) for colorless/unknown pitch.
 */
function pitchDataAttr(pitch: number | null | undefined): string | undefined {
  if (pitch === 1 || pitch === 2 || pitch === 3) return String(pitch);
  return undefined;
}

function pitchLabel(pitch: number | null | undefined): string {
  switch (pitch) {
    case 1:
      return 'Red';
    case 2:
      return 'Yellow';
    case 3:
      return 'Blue';
    default:
      return 'Colorless';
  }
}

function summarizeTiers(substituted: readonly ISubstitutedEntry[]): string {
  let tier1 = 0;
  let tier2 = 0;
  for (const entry of substituted) {
    if (entry.match.tier === 1) tier1 += entry.original.quantity;
    else if (entry.match.tier === 2) tier2 += entry.original.quantity;
  }
  return `${tier1} ${tier1 === 1 ? 'card' : 'cards'} substituted at tier 1, ${tier2} ${tier2 === 1 ? 'card' : 'cards'} at tier 2`;
}

function countNotOwned(breakdown: IBreakdown): number {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return notOwned.reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * Path C result display: a closest-playable-version summary anchored by
 * the tier-weighted fidelity percentage.
 *
 * Frame ornament per U4 spec:
 *  - Ember left border (3px solid var(--ra-ember))
 *  - var(--ra-path-c-bg) background
 *  - var(--ra-path-c-border) perimeter
 *  - Eyebrow: "APPROXIMATION" in var(--ra-path-c-ink)
 *  - Fidelity number: IBM Plex Sans 700, var(--ra-path-c), var(--ra-text-h1)
 */
export function PathCResult({
  breakdown,
  fidelityPercent,
  onTrackProximalVersion,
  onMarkOwned,
  isMarkingOwned = false,
  pendingCard = null,
  shoppingLine,
}: IPathCResultProps) {
  const displayFidelity = Math.round(fidelityPercent * 10) / 10;
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  const missingCount = countNotOwned(breakdown);
  const tierSummary = summarizeTiers(breakdown.substituted);

  const handleTrackProximal = (): void => {
    if (onTrackProximalVersion) {
      onTrackProximalVersion();
    }
  };

  const noopMarkOwned = (_cardIdentifier: string): void => {
    // Intentional no-op: the component is usable without a mark-owned handler.
  };

  return (
    <section
      aria-label="Closest playable version"
      className={styles.section}
    >
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          APPROXIMATION
        </div>
        <div className={styles.fidelityNumber}>
          {displayFidelity}%
        </div>
        <div className={styles.fidelitySubline}>
          of this deck can be assembled or substituted from your collection.
        </div>
        <div className={styles.tierSummary}>
          {tierSummary},{' '}
          {missingCount} {missingCount === 1 ? 'card' : 'cards'} still missing.
        </div>
      </header>

      <div className={styles.ctaRow}>
        <button
          type="button"
          onClick={handleTrackProximal}
          className={styles.ctaTrack}
        >
          Track proximal version
        </button>
        <a
          href={`#${MISSING_SECTION_ID}`}
          className={styles.ctaMissing}
        >
          Show me what&rsquo;s missing
        </a>
      </div>

      <ShoppingLine data={shoppingLine ?? null} />

      <BreakdownList
        breakdown={breakdown}
        onMarkOwned={onMarkOwned ?? noopMarkOwned}
        isMarkingOwned={isMarkingOwned}
        pendingCard={pendingCard}
      />

      <section
        id={MISSING_SECTION_ID}
        aria-label="Still missing"
        className={styles.missingSection}
      >
        <h3 className={styles.missingSectionHeader}>
          Still missing ({missingCount})
        </h3>
        {notOwned.length === 0 ? (
          <p className={styles.missingEmpty}>
            All cards accounted for!
          </p>
        ) : (
          <ul className={styles.missingList}>
            {notOwned.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.missingItem}
              >
                <span
                  aria-label={pitchLabel(undefined)}
                  className={styles.pitchDot}
                  data-pitch={pitchDataAttr(undefined)}
                />
                <span className={styles.missingCardName}>
                  {entry.cardIdentifier}
                </span>
                <span className={styles.missingCardMeta}>
                  x{entry.quantity} ({entry.slot})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </section>
  );
}
