import React, { useEffect, useRef, useState } from 'react';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import type { IReviewRow, TReviewRowId, IBulkOperation } from '../../api/reviews';
import { makeReviewRowId } from '../../api/reviews';
import styles from './ReviewsRow.module.css';
import { setCssVar } from '../../lib/dom/setCssVar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IReviewsRowProps {
  readonly row: IReviewRow;
  readonly isSelected: boolean;
  readonly isBulkPending: boolean;
  readonly onToggleSelect: (id: TReviewRowId) => void;
  readonly onAction: (operations: IBulkOperation[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsRow — renders a single substitution review row.
 *
 * Shows the original card (left) and the suggested substitute (right)
 * with a ◆ connector between them. Includes a tier badge, a confidence
 * bar, and the match rationale.
 *
 * Per-row Approve / Reject / Reset actions each call
 * `onAction([{ trackedDeckId, cardIdentifier, decision | reset }])` — the
 * same code path as bulk. No optimistic update.
 *
 * When `isBulkPending` is true, all per-row action buttons are disabled
 * to prevent concurrent stale mutations while a bulk op is resolving.
 */
export function ReviewsRow({
  row,
  isSelected,
  isBulkPending,
  onToggleSelect,
  onAction,
}: IReviewsRowProps): React.ReactElement {
  const rowId = makeReviewRowId(row.trackedDeckId, row.cardIdentifier);
  const checkboxId = `review-row-${rowId}`;

  const isApproved = row.decision === 'approved';
  const isRejected = row.decision === 'rejected';
  const hasDec = isApproved || isRejected;

  // Button enabled/disabled state — mirrors SubstitutionRow (deck detail) contract:
  //   pending  → Approve + Reject enabled, Reset disabled (nothing to clear)
  //   approved → Reject + Reset enabled,   Approve disabled (already approved)
  //   rejected → Approve + Reset enabled,  Reject disabled (already rejected)
  const approveDisabled = isBulkPending || isApproved;
  const rejectDisabled = isBulkPending || isRejected;
  const resetDisabled = isBulkPending || !hasDec;

  const [lightbox, setLightbox] = useState<
    | {
        readonly imageUrl: string;
        readonly sources: readonly string[];
        readonly name: string;
      }
    | null
  >(null);

  function handleApprove(): void {
    if (approveDisabled) return;
    onAction([
      {
        trackedDeckId: row.trackedDeckId,
        // Key decisions by the SUBSTITUTE id so the backend stores the row under
        // the same identifier that loadExclusions() and deck-detail look up by.
        cardIdentifier: row.substituteIdentifier,
        decision: 'APPROVED',
      },
    ]);
  }

  function handleReject(): void {
    if (rejectDisabled) return;
    onAction([
      {
        trackedDeckId: row.trackedDeckId,
        // Same substitut-keyed convention as handleApprove.
        cardIdentifier: row.substituteIdentifier,
        decision: 'REJECTED',
      },
    ]);
  }

  function handleReset(): void {
    if (resetDisabled) return;
    onAction([
      {
        trackedDeckId: row.trackedDeckId,
        // Reset also targets the substitute-keyed row.
        cardIdentifier: row.substituteIdentifier,
        reset: true,
      },
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === ' ') {
      e.preventDefault();
      onToggleSelect(rowId);
    }
  }

  const tierLabel =
    row.tier === 1
      ? 'Tier I — Close'
      : row.tier === 2
        ? 'Tier II — Loose'
        : 'Tier III — Distant';
  const confidencePct = `${row.confidence}%`;

  // --confidence drives the confidence bar fill width via CSS (continuous value).
  // First-paint race is acceptable — the bar is decorative, not load-bearing.
  const confidenceFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCssVar(confidenceFillRef.current, '--confidence', confidencePct);
  }, [confidencePct]);

  return (
    <div
      className={`${styles.row} ${isSelected ? styles['row--selected'] : ''}`}
      data-testid="reviews-row"
      data-row-id={rowId}
    >
      {/* Selection checkbox */}
      <div className={styles.checkboxCell}>
        <input
          id={checkboxId}
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(rowId)}
          aria-label={`Select ${row.cardIdentifier} substitution`}
        />
      </div>

      {/* Card pair */}
      <div
        className={styles.cardPair}
        role="group"
        aria-label={`${row.cardIdentifier} substituted by ${row.substituteName}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Original card */}
        <div className={styles.cardSlot}>
          <CardArt
            name={row.cardIdentifier}
            pitch={row.originalPitch}
            cost={null}
            type={row.originalType}
            missing={true}
            size="sm"
            imageUrl={row.originalImageUrl}
            onClick={
              row.originalImageUrl
                ? () =>
                    setLightbox({
                      imageUrl: row.originalImageUrl!.large,
                      sources: lightboxSourcesFor(row.originalImageUrl),
                      name: row.originalName,
                    })
                : undefined
            }
          />
          <span className={styles.cardLabel}>{row.originalName}</span>
        </div>

        {/* Diamond connector */}
        <span className={styles.connector} aria-hidden="true">
          ◆
        </span>

        {/* Substitute card */}
        <div className={styles.cardSlot}>
          <CardArt
            name={row.substituteName}
            pitch={row.substitutePitch}
            cost={null}
            type={row.substituteType}
            missing={false}
            size="sm"
            imageUrl={row.substituteImageUrl}
            onClick={
              row.substituteImageUrl
                ? () =>
                    setLightbox({
                      imageUrl: row.substituteImageUrl!.large,
                      sources: lightboxSourcesFor(row.substituteImageUrl),
                      name: row.substituteName,
                    })
                : undefined
            }
          />
          <span className={styles.cardLabel}>{row.substituteName}</span>
        </div>
      </div>

      {/* Meta column */}
      <div className={styles.meta}>
        {/* Deck context */}
        <div className={styles.deckContext}>
          <span className={styles.deckName}>{row.deckName}</span>
          <span className={styles.hero}>{row.hero}</span>
        </div>

        {/* Tier + confidence */}
        <div className={styles.badges}>
          <span
            className={`${styles.tierBadge} ${styles[`tierBadge--t${row.tier}`]}`}
            aria-label={tierLabel}
          >
            {tierLabel}
          </span>
          <div
            className={styles.confidenceBar}
            role="meter"
            aria-label={`Confidence ${confidencePct}`}
            aria-valuenow={row.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              ref={confidenceFillRef}
              className={styles.confidenceFill}
            />
          </div>
          <span className={styles.confidenceLabel}>{confidencePct}</span>
        </div>

        {/* Rationale */}
        <p className={styles.rationale}>
          <span aria-hidden="true" className={styles.rationalePrefix}>
            ◆
          </span>{' '}
          {row.rationale}
        </p>

        {/* Decision state indicator */}
        {row.decision !== 'pending' && (
          <span
            className={`${styles.decisionBadge} ${styles[`decisionBadge--${row.decision}`]}`}
          >
            {row.decision === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        )}

        {/* Per-row actions */}
        <div className={styles.actions} role="group" aria-label="Row actions">
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--approve']}`}
            disabled={approveDisabled}
            onClick={handleApprove}
            aria-pressed={isApproved}
            aria-label={`Approve ${row.cardIdentifier} as substitute`}
          >
            Approve
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--reject']}`}
            disabled={rejectDisabled}
            onClick={handleReject}
            aria-pressed={isRejected}
            aria-label={`Reject ${row.cardIdentifier} as substitute`}
          >
            Reject
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--reset']}`}
            disabled={resetDisabled}
            onClick={handleReset}
            aria-label={`Reset decision for ${row.cardIdentifier}`}
          >
            Reset
          </button>
        </div>
      </div>
      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
