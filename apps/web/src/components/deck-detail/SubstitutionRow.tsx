import { useEffect, useRef, useState } from 'react';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import { IBreakdownEntry, ISubstitutionMatch } from '../../api/deck-detail';
import styles from './SubstitutionRow.module.css';
import { setCssVar } from '../../lib/dom/setCssVar';

/**
 * Decision state for a substitution row.
 * Only non-pending decisions come from the server; absence implies pending.
 */
export type TDecisionState = 'pending' | 'approved' | 'rejected';

interface ISubstitutionRowProps {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
  /**
   * The current 3-state decision for this substitution row.
   * Defaults to 'pending' when absent.
   */
  readonly decision?: TDecisionState;
  /**
   * Invoked when the user clicks Approve. Receives the substitute identifier.
   * Unit 17 will wire this to the optimistic mutation.
   */
  readonly onApprove?: ((substituteIdentifier: string) => void) | undefined;
  /**
   * Invoked when the user clicks Reject. Receives the substitute identifier.
   * Unit 17 will wire this to the optimistic mutation.
   */
  readonly onReject?: ((substituteIdentifier: string) => void) | undefined;
  /**
   * Invoked when the user clicks Reset. Receives the substitute identifier.
   */
  readonly onReset?: ((substituteIdentifier: string) => void) | undefined;
  /**
   * True when this row's mutation is in flight.
   */
  readonly isPending?: boolean;
}

function getTierLabel(tier: number): string {
  if (tier === 1) return 'Tier I';
  if (tier === 2) return 'Tier II';
  return `Tier ${tier}`;
}

/**
 * SubstitutionRow — 3-state substitution row for deck detail Column B.
 *
 * Row state → button enabled-ness (from plan Key Decisions):
 *   pending  → Approve + Reject enabled, Reset disabled
 *   approved → Reject + Reset enabled, Approve shows pressed/selected state
 *   rejected → Approve + Reset enabled, Reject shows pressed/selected state
 *
 * Reset is only ever enabled when there is a decision to clear (approved or rejected).
 *
 * A11y: each row is a <li> with aria-label summarizing the substitution.
 *       Action buttons carry aria-label("Approve/Reject/Reset substitution: X for Y").
 */
export function SubstitutionRow({
  original,
  match,
  decision = 'pending',
  onApprove,
  onReject,
  onReset,
  isPending = false,
}: ISubstitutionRowProps): React.ReactElement {
  const substituteId = match.substitute.cardIdentifier;
  const originalName = original.cardIdentifier;
  const substituteName = match.substitute.name;

  const isApproved = decision === 'approved';
  const isRejected = decision === 'rejected';
  const hasDec = isApproved || isRejected;

  // Button enabled/disabled state (plan Key Decisions — row state → button enabled-ness)
  const approveDisabled = isPending || isApproved;
  const rejectDisabled = isPending || isRejected;
  const resetDisabled = isPending || !hasDec;

  function handleApprove(): void {
    if (approveDisabled || !onApprove) return;
    onApprove(substituteId);
  }

  function handleReject(): void {
    if (rejectDisabled || !onReject) return;
    onReject(substituteId);
  }

  function handleReset(): void {
    if (resetDisabled || !onReset) return;
    onReset(substituteId);
  }

  const rowClassName = [
    styles.row,
    isRejected ? styles['row--rejected'] : '',
    isApproved ? styles['row--approved'] : '',
    isPending ? styles['row--pending'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const scorePercent = Math.round(match.score * 100);
  const rowAriaLabel = `Substitution: ${originalName} for ${substituteName}, Tier ${match.tier}, ${scorePercent}% confidence, decision: ${decision}`;

  // --score drives the confidence bar fill width via CSS (continuous value).
  // First-paint race is acceptable for the confidence bar — it is decorative.
  const scoreFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCssVar(scoreFillRef.current, '--score', `${scorePercent}%`);
  }, [scorePercent]);

  // Lightbox state — local to the row so approving/rejecting a different
  // row doesn't cause cross-row flicker when the preview is open.
  const [lightbox, setLightbox] = useState<
    | {
        readonly imageUrl: string;
        readonly sources: readonly string[];
        readonly name: string;
      }
    | null
  >(null);

  return (
    <li className={rowClassName} aria-label={rowAriaLabel}>
      <div className={styles.row__cards}>
        {/* Original (left) */}
        <div className={styles.row__cardSlot}>
          <CardArt
            name={originalName}
            pitch={original.pitch}
            cost={original.cost}
            type={original.type}
            missing={false}
            size="md"
            imageUrl={original.imageUrl}
            onClick={
              original.imageUrl
                ? () =>
                    setLightbox({
                      imageUrl: original.imageUrl!.large,
                      sources: lightboxSourcesFor(original.imageUrl),
                      name: originalName,
                    })
                : undefined
            }
          />
          <span className={styles.row__cardLabel}>{originalName}</span>
        </div>

        {/* Arrow + meta */}
        <div className={styles.row__meta}>
          <span className={styles.row__arrow} aria-hidden="true">&#8594;</span>
          <span className={styles.row__tier}>{getTierLabel(match.tier)}</span>
          <div className={styles.row__scoreBar}>
            <div
              ref={scoreFillRef}
              className={styles.row__scoreFill}
            />
          </div>
          <span className={styles.row__scoreLabel}>{scorePercent}%</span>
          {hasDec && (
            <span className={styles.row__reviewedBadge}>Reviewed</span>
          )}
        </div>

        {/* Substitute (right) */}
        <div className={styles.row__cardSlot}>
          {/*
            ISubstituteCard omits cost and type (only pitch is meaningful for
            the substitution engine's primary score axis). Fall back to null
            and 'action' so CardArt renders a neutral glyph instead of
            crashing on a required field. Unit 11 can enrich ISubstituteCard
            if the cost/type glyphs become important for Gate 2 comprehension.
          */}
          <CardArt
            name={substituteName}
            pitch={match.substitute.pitch as 1 | 2 | 3 | null}
            cost={null}
            type="action"
            missing={isRejected}
            size="md"
            imageUrl={match.substitute.imageUrl}
            onClick={
              match.substitute.imageUrl
                ? () =>
                    setLightbox({
                      imageUrl: match.substitute.imageUrl!.large,
                      sources: lightboxSourcesFor(match.substitute.imageUrl),
                      name: substituteName,
                    })
                : undefined
            }
          />
          <span className={styles.row__cardLabel}>{substituteName}</span>
        </div>
      </div>

      {/* Rationale */}
      <p className={styles.row__rationale}>
        <span className={styles.row__rationaleGlyph} aria-hidden="true">&#9670;</span>
        {match.rationale}
      </p>

      {/* 3-state action buttons */}
      <div className={styles.row__actions}>
        <button
          type="button"
          className={[
            styles.row__btn,
            styles['row__btn--approve'],
            isApproved ? styles['row__btn--active'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleApprove}
          disabled={approveDisabled}
          aria-pressed={isApproved}
          aria-label={`Approve substitution: ${originalName} for ${substituteName}`}
        >
          <span aria-hidden="true">&#10003;</span> Approve
        </button>

        <button
          type="button"
          className={[
            styles.row__btn,
            styles['row__btn--reject'],
            isRejected ? styles['row__btn--active'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleReject}
          disabled={rejectDisabled}
          aria-pressed={isRejected}
          aria-label={`Reject substitution: ${originalName} for ${substituteName}`}
        >
          <span aria-hidden="true">&#10005;</span> Reject
        </button>

        <button
          type="button"
          className={[styles.row__btn, styles['row__btn--reset']]
            .filter(Boolean)
            .join(' ')}
          onClick={handleReset}
          disabled={resetDisabled}
          aria-label={`Reset decision: ${originalName} for ${substituteName}`}
        >
          <span aria-hidden="true">&#8635;</span> Reset
        </button>
      </div>
      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </li>
  );
}
