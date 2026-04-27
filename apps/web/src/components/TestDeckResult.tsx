import { Link } from '@tanstack/react-router';
import { IBreakdown } from '../api/deck-detail';
import { ITestDeckResponse } from '../api/test-deck';
import { BreakdownList } from './breakdown-list';
import { PathCResult } from './path-c-result';
import { ShoppingLine } from './ShoppingLine';
import styles from './TestDeckResult.module.css';

interface ITestDeckResultProps {
  readonly result: ITestDeckResponse;
  /**
   * Fires when the user clicks "Track this deck". The parent should
   * call the import mutation with `seedInventory: false`.
   */
  readonly onTrack: () => void;
  /**
   * Fires when the user clicks "Track + add cards to collection".
   * The parent should call the import mutation with `seedInventory: true`.
   */
  readonly onTrackAndSeed: () => void;
  readonly isTracking: boolean;
}

/**
 * Renders the result of `POST /api/decks/test`. Mirrors the deck detail
 * page layout so users get a familiar readiness header, breakdown, and
 * substitution list -- except that nothing has been persisted yet.
 *
 * The CTAs branch on `result.alreadyTracked`:
 *  - false: "Track this deck" (no inventory) and "Track + add cards"
 *  - true: a callout with a Go-to-deck link, no track buttons
 *
 * Path C results delegate to the shared `PathCResult` component from
 * Unit 8, which already owns the fidelity header and missing-cards
 * list. Path A/B render the standard breakdown inline.
 *
 * PathBadge per U4 spec:
 *  - Path A: omitted entirely (default success state, no badge dilution)
 *  - Path B: brass-secondary "SUBBED" pill (var(--ra-accent-soft-*))
 *  - Path C: ember-accent "APPROX" pill (rgba ember tokens)
 */
export function TestDeckResult({
  result,
  onTrack,
  onTrackAndSeed,
  isTracking,
}: ITestDeckResultProps) {
  const breakdown: IBreakdown = result.breakdown as unknown as IBreakdown;
  const displayEffective = Math.round(result.effectivePercent * 10) / 10;
  const displayRaw = Math.round(result.rawPercent * 10) / 10;

  return (
    <section
      aria-label="Test deck result"
      className={styles.section}
    >
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h2 className={styles.headerTitle}>{result.name}</h2>
          <PathBadge path={result.path} />
        </div>
        <div className={styles.headerMeta}>
          {result.hero} &mdash; {result.format}
        </div>
      </header>

      {result.path === 'C' ? (
        <>
          <hr aria-hidden="true" className={styles.pathCSeparator} />
          <PathCResult
            breakdown={breakdown}
            fidelityPercent={result.fidelityPercent}
            onTrackProximalVersion={onTrack}
            {...(result.shoppingLine !== undefined ? { shoppingLine: result.shoppingLine } : {})}
          />
        </>
      ) : (
        <>
          <div
            role="status"
            className={styles.readinessBox}
          >
            <div className={styles.readinessPercent}>
              {displayEffective}%
            </div>
            <div className={styles.readinessSubline}>
              Effective readiness ({displayRaw}% exact)
            </div>
          </div>

          <BreakdownList
            breakdown={breakdown}
            onMarkOwned={() => undefined}
            isMarkingOwned={false}
            pendingCard={null}
          />
        </>
      )}

      <ShoppingLine data={result.shoppingLine ?? null} />

      {result.alreadyTracked && result.trackedDeckId !== null ? (
        <AlreadyTrackedCallout trackedDeckId={result.trackedDeckId} />
      ) : (
        <TrackActions
          onTrack={onTrack}
          onTrackAndSeed={onTrackAndSeed}
          isTracking={isTracking}
        />
      )}
    </section>
  );
}

/**
 * PathBadge — per U4 spec:
 *  - Path A: no badge (return null)
 *  - Path B: brass-secondary "SUBBED" pill
 *  - Path C: ember-accent "APPROX" pill
 *
 * Uses data-path attribute + CSS Module rules (low-cardinality enum pattern).
 */
function PathBadge({ path }: { readonly path: 'A' | 'B' | 'C' }) {
  // Path A has no badge per spec — omit to preserve signal strength on B/C.
  if (path === 'A') return null;

  const label = path === 'B' ? 'SUBBED' : 'APPROX';

  return (
    <span
      aria-label={`Path ${path}`}
      className={styles.pathBadge}
      data-path={path}
    >
      {label}
    </span>
  );
}

function AlreadyTrackedCallout({ trackedDeckId }: { readonly trackedDeckId: number }) {
  return (
    <div
      role="status"
      className={styles.alreadyTrackedCallout}
    >
      <strong className={styles.alreadyTrackedHeading}>This deck is already tracked.</strong>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(trackedDeckId) }}
        className={styles.alreadyTrackedLink}
      >
        Go to deck &rarr;
      </Link>
    </div>
  );
}

interface ITrackActionsProps {
  readonly onTrack: () => void;
  readonly onTrackAndSeed: () => void;
  readonly isTracking: boolean;
}

function TrackActions({ onTrack, onTrackAndSeed, isTracking }: ITrackActionsProps) {
  return (
    <div className={styles.trackActions}>
      <button
        type="button"
        disabled={isTracking}
        onClick={onTrack}
        className={`${styles.trackBtn} ${styles['trackBtn--primary']}`}
      >
        {isTracking ? 'Tracking...' : 'Track this deck'}
      </button>
      <button
        type="button"
        disabled={isTracking}
        onClick={onTrackAndSeed}
        className={`${styles.trackBtn} ${styles['trackBtn--secondary']}`}
      >
        Track + add cards to collection
      </button>
    </div>
  );
}
