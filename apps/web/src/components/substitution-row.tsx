import { useTranslation } from 'react-i18next';
import { IBreakdownEntry, ISubstitutionMatch } from '../api/deck-detail';
import styles from './substitution-row.module.css';

interface ISubstitutionRowProps {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
  /**
   * Callback invoked when the user clicks the reject button. Receives
   * the *substitute* identifier (not the original) — that is the
   * identifier the rejection set keys on.
   *
   * Explicit `| undefined` keeps this assignable from an optional caller
   * prop under `exactOptionalPropertyTypes: true`.
   */
  readonly onReject?: ((substituteIdentifier: string) => void) | undefined;
  /**
   * True when this specific row's rejection is in flight. The row
   * dims to 50% opacity and the reject button disables.
   */
  readonly isPending?: boolean;
  /**
   * True when any row in the list has a rejection in flight. Used
   * to disable reject buttons on every row except the one that
   * triggered the mutation. This prevents conflicting concurrent
   * requests while a rejection is resolving.
   */
  readonly anyPending?: boolean;
  /**
   * When true, renders a pitch-curve warning icon + inline message
   * beneath the substitute. Surfaced when a previous rejection broke
   * the curve and no alternative exists for this slot.
   */
  readonly curveWarning?: boolean | undefined;
}

export function SubstitutionRow({
  original,
  match,
  onReject,
  isPending = false,
  anyPending = false,
  curveWarning = false,
}: ISubstitutionRowProps) {
  const { t } = useTranslation();
  const disabled = isPending || anyPending;

  function handleReject(): void {
    if (!onReject || disabled) return;
    onReject(match.substitute.cardIdentifier);
  }

  return (
    <div
      data-pending={isPending ? 'true' : 'false'}
      className={styles.row}
    >
      <div className={styles.rowHeader}>
        <span className={styles.originalName}>{original.cardIdentifier}</span>
        <span className={styles.arrow}>&rarr;</span>
        <span className={styles.substituteName}>
          {match.substitute.name}
        </span>
        <span className={styles.tierBadge}>
          {t('decks.tierLabel', { tier: match.tier })}
        </span>
        <span className={styles.score}>
          ({(match.score * 100).toFixed(0)}%)
        </span>
        <span className={styles.spacer} />
        {onReject && (
          <button
            type="button"
            onClick={handleReject}
            disabled={disabled}
            aria-label={t('decks.rejectThisSubstitutionAria')}
            className={styles.rejectBtn}
          >
            &times;
          </button>
        )}
      </div>
      <div className={styles.rationale}>
        {match.rationale}
      </div>
      {curveWarning && (
        <div
          role="status"
          className={styles.curveWarning}
        >
          <span aria-hidden="true">&#9888;</span>
          {t('decks.pitchCurveBroken')}
        </div>
      )}
    </div>
  );
}
