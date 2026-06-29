import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
 * ReviewsRow — renders a single swap review row with an accordion for
 * decided rows.
 *
 * Three render modes:
 *  - Pending decision → full layout (cards + tier + confidence + rationale +
 *    Approve / Reject / Reset buttons). The user needs to decide.
 *  - Decided + collapsed (default after first render of a decided row) →
 *    compact layout: checkbox + thumbs + deck context + big "Approved" or
 *    "Rejected" badge + "Change ▾" toggle. No competing visual noise from
 *    disabled action buttons.
 *  - Decided + expanded (user clicked "Change") → full layout, same as
 *    pending, plus a "Done ▴" toggle to collapse back.
 *
 * The expanded state lives only in component memory — page refresh starts
 * decided rows collapsed again.
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
  const { t } = useTranslation();
  const rowId = makeReviewRowId(row.trackedDeckId, row.cardIdentifier, row.substituteIdentifier);
  const checkboxId = `review-row-${rowId}`;

  const isApproved = row.decision === 'approved';
  const isRejected = row.decision === 'rejected';
  const hasDec = isApproved || isRejected;

  // Accordion state — only meaningful when hasDec. Decided rows start
  // collapsed; "Change" toggles to expanded; "Done" collapses again.
  const [isExpanded, setIsExpanded] = useState(false);
  const isCollapsed = hasDec && !isExpanded;

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

  const tierLabels: Record<number, string> = {
    1: t('reviews.tierI'),
    2: t('reviews.tierII'),
    3: t('reviews.tierIII'),
  };
  const tierLabel = tierLabels[row.tier] ?? t('reviews.tierIII');
  const confidencePct = `${row.confidence}%`;

  // --confidence drives the confidence bar fill width via CSS (continuous value).
  // First-paint race is acceptable — the bar is decorative, not load-bearing.
  const confidenceFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCssVar(confidenceFillRef.current, '--confidence', confidencePct);
  }, [confidencePct]);

  // ----- Card thumbs (shared between collapsed + expanded) -----
  const originalThumb = (
    <CardArt
      name={row.cardIdentifier}
      pitch={row.originalPitch}
      cost={null}
      type={row.originalType}
      missing={true}
      size={isCollapsed ? 'xs' : 'sm'}
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
  );

  const substituteThumb = (
    <CardArt
      name={row.substituteName}
      pitch={row.substitutePitch}
      cost={null}
      type={row.substituteType}
      missing={false}
      size={isCollapsed ? 'xs' : 'sm'}
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
  );

  // ----- Collapsed render (decided + not expanded) -----
  if (isCollapsed) {
    return (
      <div
        className={`${styles.row} ${styles['row--collapsed']} ${
          isSelected ? styles['row--selected'] : ''
        }`}
        data-testid="reviews-row"
        data-row-id={rowId}
        data-state={row.decision}
      >
        <div className={styles.checkboxCell}>
          <input
            id={checkboxId}
            type="checkbox"
            className={styles.checkbox}
            checked={isSelected}
            onChange={() => onToggleSelect(rowId)}
            aria-label={t('reviews.selectSubAria', { cardIdentifier: row.cardIdentifier })}
          />
        </div>

        <div className={styles.collapsedPair}>
          <div className={styles.collapsedThumb}>{originalThumb}</div>
          <span className={styles.connectorCompact} aria-hidden="true">
            ◆
          </span>
          <div className={styles.collapsedThumb}>{substituteThumb}</div>
        </div>

        <div className={styles.collapsedSummary}>
          <div className={styles.collapsedDeckLine}>
            <span className={styles.collapsedDeckName}>{row.deckName}</span>
            <span className={styles.collapsedHero}>{row.hero}</span>
          </div>
          <div className={styles.collapsedNames}>
            <span className={styles.collapsedNameOriginal}>
              {row.originalName}
            </span>
            <span className={styles.collapsedArrow} aria-hidden="true">
              →
            </span>
            <span className={styles.collapsedNameSubstitute}>
              {row.substituteName}
            </span>
          </div>
        </div>

        <div className={styles.collapsedDecision}>
          <span
            className={`${styles.bigDecisionBadge} ${styles[`bigDecisionBadge--${row.decision}`]}`}
            aria-label={isApproved ? t('reviews.decisionApprovedAria') : t('reviews.decisionRejectedAria')}
          >
            {isApproved ? (
              <>
                <span aria-hidden="true">✓</span> {t('reviews.decisionApproved')}
              </>
            ) : (
              <>
                <span aria-hidden="true">✕</span> {t('reviews.decisionRejected')}
              </>
            )}
          </span>
          <button
            type="button"
            className={styles.changeBtn}
            onClick={() => setIsExpanded(true)}
            aria-expanded={false}
            aria-controls={`row-actions-${rowId}`}
            aria-label={t('reviews.changeDecisionAria', { cardIdentifier: row.cardIdentifier })}
          >
            {t('reviews.change')} <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
    );
  }

  // ----- Expanded render (pending OR decided + expanded) -----
  return (
    <div
      className={`${styles.row} ${isSelected ? styles['row--selected'] : ''}`}
      data-testid="reviews-row"
      data-row-id={rowId}
      data-state={row.decision}
    >
      {/* Selection checkbox */}
      <div className={styles.checkboxCell}>
        <input
          id={checkboxId}
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(rowId)}
          aria-label={t('reviews.selectSubAria', { cardIdentifier: row.cardIdentifier })}
        />
      </div>

      {/* Card pair */}
      <div
        className={styles.cardPair}
        role="group"
        aria-label={t('reviews.cardPairAria', { cardIdentifier: row.cardIdentifier, substituteName: row.substituteName })}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.cardSlot}>
          {originalThumb}
          <span className={styles.cardLabel}>{row.originalName}</span>
        </div>
        <span className={styles.connector} aria-hidden="true">
          ◆
        </span>
        <div className={styles.cardSlot}>
          {substituteThumb}
          <span className={styles.cardLabel}>{row.substituteName}</span>
        </div>
      </div>

      {/* Meta column */}
      <div className={styles.meta} id={`row-actions-${rowId}`}>
        <div className={styles.deckContext}>
          <span className={styles.deckName}>{row.deckName}</span>
          <span className={styles.hero}>{row.hero}</span>
        </div>

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
            aria-label={t('reviews.confidenceAria', { pct: confidencePct })}
            aria-valuenow={row.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div ref={confidenceFillRef} className={styles.confidenceFill} />
          </div>
          <span className={styles.confidenceLabel}>{confidencePct}</span>
        </div>

        <p className={styles.rationale}>
          <span aria-hidden="true" className={styles.rationalePrefix}>
            ◆
          </span>{' '}
          {row.rationale}
        </p>

        {/* Decision badge — visible when expanded with a decision so the
            user keeps the current state in view while they consider changing
            it. Bigger than before; matches the collapsed-state badge styling. */}
        {hasDec && (
          <span
            className={`${styles.bigDecisionBadge} ${styles[`bigDecisionBadge--${row.decision}`]} ${styles.bigDecisionBadgeInline}`}
          >
            {isApproved ? (
              <>
                <span aria-hidden="true">✓</span> {t('reviews.decisionApproved')}
              </>
            ) : (
              <>
                <span aria-hidden="true">✕</span> {t('reviews.decisionRejected')}
              </>
            )}
          </span>
        )}

        {/* Per-row actions */}
        <div className={styles.actions} role="group" aria-label={t('reviews.rowActionsAria')}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--approve']}`}
            disabled={approveDisabled}
            onClick={handleApprove}
            aria-pressed={isApproved}
            aria-label={t('reviews.approveAria', { cardIdentifier: row.cardIdentifier })}
          >
            {t('reviews.approve')}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--reject']}`}
            disabled={rejectDisabled}
            onClick={handleReject}
            aria-pressed={isRejected}
            aria-label={t('reviews.rejectAria', { cardIdentifier: row.cardIdentifier })}
          >
            {t('reviews.reject')}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles['actionBtn--reset']}`}
            disabled={resetDisabled}
            onClick={handleReset}
            aria-label={t('reviews.resetDecisionAria', { cardIdentifier: row.cardIdentifier })}
          >
            {t('reviews.reset')}
          </button>
          {hasDec && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles['actionBtn--collapse']}`}
              onClick={() => setIsExpanded(false)}
              aria-expanded={true}
              aria-controls={`row-actions-${rowId}`}
              aria-label={t('reviews.collapseAria', { cardIdentifier: row.cardIdentifier })}
            >
              {t('reviews.done')} <span aria-hidden="true">▴</span>
            </button>
          )}
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
