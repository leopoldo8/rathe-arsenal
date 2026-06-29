import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

type TTranslate = TFunction;

function getTierLabel(tier: number, t: TTranslate): string {
  if (tier === 1) return t('decks.tierI');
  if (tier === 2) return t('decks.tierII');
  if (tier === 3) return t('decks.tierIII');
  return t('decks.tierLabel', { tier });
}

/**
 * SubstitutionRow — 3-state substitution row for deck detail Column B.
 *
 * Three render modes:
 *  - Pending decision → full layout (cards · meta · rationale · 3 action
 *    buttons). The user needs to decide.
 *  - Decided + collapsed (default after first render of a decided row) →
 *    compact layout: small thumbs · "X → Y" line · big "Approved" or
 *    "Rejected" badge · "Change ▾" toggle. Removes the ghosted action
 *    buttons that previously read as "still needs a decision".
 *  - Decided + expanded (user clicked Change) → full layout, plus a "Done"
 *    collapser to return to the compact state.
 *
 * The expanded state lives only in component memory — page refresh starts
 * decided rows collapsed again.
 *
 * Row state → button enabled-ness (from plan Key Decisions):
 *   pending  → Approve + Reject enabled, Reset disabled
 *   approved → Reject + Reset enabled, Approve shows pressed/selected state
 *   rejected → Approve + Reset enabled, Reject shows pressed/selected state
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
  const { t } = useTranslation();
  const substituteId = match.substitute.cardIdentifier;
  const originalName = original.name;
  const substituteName = match.substitute.name;

  const isApproved = decision === 'approved';
  const isRejected = decision === 'rejected';
  const hasDec = isApproved || isRejected;

  // Accordion state — only meaningful when hasDec. Decided rows start
  // collapsed; "Change" toggles to expanded; "Done" collapses again.
  const [isExpanded, setIsExpanded] = useState(false);
  const isCollapsed = hasDec && !isExpanded;

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
    isCollapsed ? styles['row--collapsed'] : '',
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

  // ----- Card thumbs (shared between modes; size differs) -----
  const thumbSize = isCollapsed ? 'sm' : 'md';

  const originalThumb = (
    <CardArt
      name={originalName}
      pitch={original.pitch}
      cost={original.cost}
      type={original.type}
      missing={false}
      size={thumbSize}
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
  );

  const substituteThumb = (
    <CardArt
      name={substituteName}
      pitch={match.substitute.pitch as 1 | 2 | 3 | null}
      cost={null}
      type="action"
      missing={isRejected}
      size={thumbSize}
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
  );

  // ----- Collapsed render (decided + not expanded) -----
  if (isCollapsed) {
    return (
      <li className={rowClassName} aria-label={rowAriaLabel}>
        <div className={styles.collapsed}>
          <div className={styles.collapsedPair}>
            {originalThumb}
            <span className={styles.collapsedArrow} aria-hidden="true">
              &#8594;
            </span>
            {substituteThumb}
          </div>

          <div className={styles.collapsedSummary}>
            <div className={styles.collapsedNames}>
              <span className={styles.collapsedNameOriginal}>{originalName}</span>
              <span className={styles.collapsedNameArrow} aria-hidden="true">
                &#8594;
              </span>
              <span className={styles.collapsedNameSubstitute}>
                {substituteName}
              </span>
            </div>
            <div className={styles.collapsedMeta}>
              <span className={styles.row__tier}>{getTierLabel(match.tier, t)}</span>
              <span className={styles.row__scoreLabel}>{scorePercent}%</span>
            </div>
          </div>

          <div className={styles.collapsedDecision}>
            <span
              className={`${styles.bigDecisionBadge} ${styles[`bigDecisionBadge--${decision}`]}`}
              aria-label={`Decision: ${decision}`}
            >
              {isApproved ? (
                <>
                  <span aria-hidden="true">&#10003;</span> {t('decks.decisionApproved')}
                </>
              ) : (
                <>
                  <span aria-hidden="true">&#10005;</span> {t('decks.decisionRejected')}
                </>
              )}
            </span>
            <button
              type="button"
              className={styles.changeBtn}
              onClick={() => setIsExpanded(true)}
              disabled={isPending}
              aria-expanded={false}
              aria-label={t('decks.changeDecisionAria', { name: originalName })}
            >
              {t('decks.changeDecisionBtn')}
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
      </li>
    );
  }

  // ----- Expanded render (pending OR decided + expanded) -----
  return (
    <li className={rowClassName} aria-label={rowAriaLabel}>
      <div className={styles.row__cards}>
        <div className={styles.row__cardSlot}>
          {originalThumb}
          <span className={styles.row__cardLabel}>{originalName}</span>
        </div>

        <div className={styles.row__meta}>
          <span className={styles.row__arrow} aria-hidden="true">&#8594;</span>
          <span className={styles.row__tier}>{getTierLabel(match.tier, t)}</span>
          <div className={styles.row__scoreBar}>
            <div ref={scoreFillRef} className={styles.row__scoreFill} />
          </div>
          <span className={styles.row__scoreLabel}>{scorePercent}%</span>
          {hasDec && (
            <span
              className={`${styles.bigDecisionBadge} ${styles[`bigDecisionBadge--${decision}`]} ${styles.bigDecisionBadgeInline}`}
            >
              {isApproved ? (
                <>
                  <span aria-hidden="true">&#10003;</span> {t('decks.decisionApproved')}
                </>
              ) : (
                <>
                  <span aria-hidden="true">&#10005;</span> {t('decks.decisionRejected')}
                </>
              )}
            </span>
          )}
        </div>

        <div className={styles.row__cardSlot}>
          {substituteThumb}
          <span className={styles.row__cardLabel}>{substituteName}</span>
        </div>
      </div>

      <p className={styles.row__rationale}>
        <span className={styles.row__rationaleGlyph} aria-hidden="true">&#9670;</span>
        {match.rationale}
      </p>

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
          aria-label={t('decks.approveSubstitutionAria', { original: originalName, substitute: substituteName })}
        >
          <span aria-hidden="true">&#10003;</span> {t('decks.approveBtn')}
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
          aria-label={t('decks.rejectSubstitutionAria', { original: originalName, substitute: substituteName })}
        >
          <span aria-hidden="true">&#10005;</span> {t('decks.rejectBtn')}
        </button>

        <button
          type="button"
          className={[styles.row__btn, styles['row__btn--reset']]
            .filter(Boolean)
            .join(' ')}
          onClick={handleReset}
          disabled={resetDisabled}
          aria-label={t('decks.resetDecisionAria', { original: originalName, substitute: substituteName })}
        >
          <span aria-hidden="true">&#8635;</span> {t('decks.resetBtn')}
        </button>

        {hasDec && (
          <button
            type="button"
            className={[styles.row__btn, styles['row__btn--collapse']]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIsExpanded(false)}
            aria-expanded={true}
            aria-label={t('decks.collapseSwapAria', { name: originalName })}
          >
            {t('decks.doneDecisionBtn')}
          </button>
        )}
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
