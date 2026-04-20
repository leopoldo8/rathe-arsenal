import { CardArt } from '../card-art/CardArt';
import { IBreakdown, IDecisionEntry } from '../../api/deck-detail';
import { SubstitutionRow, TDecisionState } from './SubstitutionRow';
import { MarkOwnedButton } from './MarkOwnedButton';
import styles from './BreakdownSections.module.css';

interface IBreakdownSectionsProps {
  readonly breakdown: IBreakdown;
  /**
   * All non-pending decisions for this deck.
   * Used to resolve per-row decision state for SubstitutionRow.
   */
  readonly decisions: readonly IDecisionEntry[];
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onApproveSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onRejectSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onResetSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly pendingSubstituteId?: string | null;
}

function resolveDecision(
  decisions: readonly IDecisionEntry[],
  cardIdentifier: string,
): TDecisionState {
  const entry = decisions.find((d) => d.cardIdentifier === cardIdentifier);
  if (!entry) return 'pending';
  return entry.decision;
}

/**
 * BreakdownSections — Column B of deck detail.
 *
 * Renders three sections:
 *  1. Exact matches — CardArt sm grid
 *  2. Substituted — SubstitutionRow list (3-state)
 *  3. Not owned — CardArt xs list with MarkOwnedButton
 *
 * A11y: substitution list uses <ul> + <li>; each row carries aria-label.
 */
export function BreakdownSections({
  breakdown,
  decisions,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
  pendingSubstituteId = null,
}: IBreakdownSectionsProps): React.ReactElement {
  const notOwned = breakdown.notOwned ?? breakdown.missing;

  return (
    <div id="breakdown" className={styles.sections}>
      {/* ---- Exact matches ---- */}
      <section className={styles.section} aria-labelledby="section-exact">
        <div className={styles.section__header}>
          <div className={styles.section__diamond} />
          <h2 id="section-exact" className={styles.section__title}>
            Exact matches
          </h2>
          <span className={styles.section__count}>{breakdown.exact.length} cards</span>
        </div>

        {breakdown.exact.length === 0 ? (
          <p className={styles.section__empty}>No exact matches</p>
        ) : (
          <div className={styles.cardGrid}>
            {breakdown.exact.slice(0, 8).map((entry) => (
              <div
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.cardCell}
              >
                <CardArt
                  name={entry.cardIdentifier}
                  pitch={entry.pitch}
                  cost={entry.cost}
                  type={entry.type}
                  missing={false}
                  size="sm"
                />
                <span className={styles.cardCell__qty}>
                  &#215;{entry.quantity}
                </span>
              </div>
            ))}
            {breakdown.exact.length > 8 && (
              <div className={styles.cardCellMore}>
                <div className={styles.cardCellMore__n}>
                  +{breakdown.exact.length - 8}
                </div>
                <div className={styles.cardCellMore__l}>more</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Substituted ---- */}
      <section className={styles.section} aria-labelledby="section-subs">
        <div className={styles.section__header}>
          <div className={styles.section__diamond} />
          <h2 id="section-subs" className={styles.section__title}>
            Substituted
          </h2>
          <span className={styles.section__count}>
            {breakdown.substituted.length} active
          </span>
        </div>

        {breakdown.substituted.length === 0 ? (
          <p className={styles.section__empty}>No substitutions needed</p>
        ) : (
          <ul className={styles.subList} aria-label="Substitution proposals">
            {breakdown.substituted.map((entry) => {
              const subId = entry.match.substitute.cardIdentifier;
              const decision = resolveDecision(decisions, subId);
              return (
                <SubstitutionRow
                  key={`${entry.original.cardIdentifier}-${entry.original.slot}`}
                  original={entry.original}
                  match={entry.match}
                  decision={decision}
                  onApprove={onApproveSubstitute}
                  onReject={onRejectSubstitute}
                  onReset={onResetSubstitute}
                  isPending={pendingSubstituteId === subId}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Not owned ---- */}
      <section className={styles.section} aria-labelledby="section-not-owned">
        <div className={styles.section__header}>
          <div className={[styles.section__diamond, styles['section__diamond--low']].join(' ')} />
          <h2 id="section-not-owned" className={styles.section__title}>
            Not owned
          </h2>
          <span className={styles.section__count}>{notOwned.length} cards</span>
        </div>

        {notOwned.length === 0 ? (
          <div className={styles.emptyAllPlayable}>
            <p className={styles.emptyAllPlayable__title}>
              All playable — no substitutions needed.
            </p>
            <p className={styles.emptyAllPlayable__sub}>
              Your collection covers every slot in this deck.
            </p>
          </div>
        ) : (
          <ul className={styles.missList} aria-label="Cards not in collection">
            {notOwned.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.missRow}
              >
                <CardArt
                  name={entry.cardIdentifier}
                  pitch={entry.pitch}
                  cost={entry.cost}
                  type={entry.type}
                  missing={true}
                  size="xs"
                />
                <div className={styles.missRow__body}>
                  <div className={styles.missRow__name}>{entry.cardIdentifier}</div>
                  <div className={styles.missRow__meta}>{entry.slot}</div>
                </div>
                <span className={styles.missRow__qty}>
                  &#215;{entry.quantity}
                </span>
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
