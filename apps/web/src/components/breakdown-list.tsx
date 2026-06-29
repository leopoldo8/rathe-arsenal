import { useTranslation } from 'react-i18next';
import { IBreakdown } from '../api/deck-detail';
import { SubstitutionRow } from './substitution-row';
import { MarkOwnedButton } from './mark-owned-button';
import styles from './breakdown-list.module.css';

interface IBreakdownListProps {
  readonly breakdown: IBreakdown;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  /**
   * When supplied, each substitution row renders a reject button.
   * Invoked with the **substitute** card identifier.
   */
  readonly onRejectSubstitute?: (substituteIdentifier: string) => void;
  /**
   * Substitute identifier whose rejection is currently in flight.
   */
  readonly pendingRejection?: string | null;
  /**
   * Set of original card identifiers that should render a curve
   * warning on their substitution row.
   */
  readonly curveWarnings?: ReadonlySet<string>;
}

export function BreakdownList({
  breakdown,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onRejectSubstitute,
  pendingRejection = null,
  curveWarnings,
}: IBreakdownListProps) {
  const { t } = useTranslation();
  const anyRejectionPending = pendingRejection !== null;

  // Use the engine-computed notOwned list. Fall back to missing for legacy
  // snapshots persisted before the notOwned field existed.
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return (
    <div className={styles.container}>
      {/* Exact matches */}
      <section>
        <h3 className={`${styles.sectionHeading} ${styles['sectionHeading--exact']}`}>
          {t('decks.breakdownExactHeading', { count: breakdown.exact.length })}
        </h3>
        {breakdown.exact.length === 0 ? (
          <p className={styles.emptyMsg}>
            {t('decks.noExactMatches')}
          </p>
        ) : (
          <ul className={styles.exactList}>
            {breakdown.exact.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.exactItem}
              >
                <span>{entry.cardIdentifier}</span>
                <span className={styles.exactItemMeta}>
                  x{entry.quantity} ({entry.slot})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Swaps */}
      <section>
        <h3 className={`${styles.sectionHeading} ${styles['sectionHeading--substituted']}`}>
          {t('decks.breakdownSwapsHeading', { count: breakdown.substituted.length })}
        </h3>
        {breakdown.substituted.length === 0 ? (
          <p className={styles.emptyMsg}>
            {t('decks.breakdownNoSwaps')}
          </p>
        ) : (
          <div>
            {breakdown.substituted.map((entry) => (
              <SubstitutionRow
                key={`${entry.original.cardIdentifier}-${entry.original.slot}`}
                original={entry.original}
                match={entry.match}
                onReject={onRejectSubstitute}
                isPending={
                  pendingRejection === entry.match.substitute.cardIdentifier
                }
                anyPending={anyRejectionPending}
                curveWarning={curveWarnings?.has(entry.original.cardIdentifier)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Not owned — all cards the user doesn't fully own, regardless
          of whether a substitution suggestion exists. */}
      <section>
        <h3 className={`${styles.sectionHeading} ${styles['sectionHeading--notOwned']}`}>
          {t('decks.breakdownNotOwnedHeading', { count: notOwned.length })}
        </h3>
        {notOwned.length === 0 ? (
          <p className={styles.emptyMsg}>
            {t('decks.breakdownAllAccountedFor')}
          </p>
        ) : (
          <ul className={styles.notOwnedList}>
            {notOwned.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.notOwnedItem}
              >
                <div className={styles.notOwnedItemLeft}>
                  <span>{entry.cardIdentifier}</span>
                  <span className={styles.notOwnedItemMeta}>
                    x{entry.quantity} ({entry.slot})
                  </span>
                </div>
                <MarkOwnedButton
                  cardIdentifier={entry.cardIdentifier}
                  onMarkOwned={onMarkOwned}
                  isPending={isMarkingOwned}
                  pendingCard={pendingCard}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
