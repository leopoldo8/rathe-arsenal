import { useState } from 'react';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
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

function sumQuantities(entries: readonly { readonly quantity: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
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

  // Single lightbox at the section root — only one card can be expanded
  // at a time across exact + not-owned grids. SubstitutionRow owns its
  // own local lightbox so substitute clicks stay per-row.
  const [lightbox, setLightbox] = useState<
    | {
        readonly imageUrl: string;
        readonly sources: readonly string[];
        readonly name: string;
      }
    | null
  >(null);

  return (
    <div id="breakdown" className={styles.sections}>
      {/* ---- Exact matches ---- */}
      <section className={styles.section} aria-labelledby="section-exact">
        <div className={styles.section__header}>
          <div className={styles.section__diamond} />
          <h2 id="section-exact" className={styles.section__title}>
            Exact matches
          </h2>
          <span className={styles.section__count}>{sumQuantities(breakdown.exact)} cards</span>
        </div>

        {breakdown.exact.length === 0 ? (
          <p className={styles.section__empty}>No exact matches</p>
        ) : (
          <div className={styles.cardGrid}>
            {breakdown.exact.map((entry) => (
              <div
                key={`${entry.cardIdentifier}-${entry.slot}`}
                className={styles.cardCell}
              >
                <CardArt
                  name={entry.name}
                  pitch={entry.pitch}
                  cost={entry.cost}
                  type={entry.type}
                  missing={false}
                  size="sm"
                  imageUrl={entry.imageUrl}
                  onClick={
                    entry.imageUrl
                      ? () =>
                          setLightbox({
                            imageUrl: entry.imageUrl!.large,
                            sources: lightboxSourcesFor(entry.imageUrl),
                            name: entry.cardIdentifier,
                          })
                      : undefined
                  }
                />
                <span className={styles.cardCell__qty}>
                  &#215;{entry.quantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Swaps ---- */}
      <section className={styles.section} aria-labelledby="section-subs">
        <div className={styles.section__header}>
          <div className={styles.section__diamond} />
          <h2 id="section-subs" className={styles.section__title}>
            Swaps
          </h2>
          <span className={styles.section__count}>
            {breakdown.substituted.length} active
          </span>
        </div>

        {breakdown.substituted.length === 0 ? (
          <p className={styles.section__empty}>No swaps needed</p>
        ) : (
          <ul className={styles.subList} aria-label="Swap proposals">
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
          <span className={styles.section__count}>{sumQuantities(notOwned)} cards</span>
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
                  name={entry.name}
                  pitch={entry.pitch}
                  cost={entry.cost}
                  type={entry.type}
                  missing={true}
                  size="xs"
                  imageUrl={entry.imageUrl}
                  onClick={
                    entry.imageUrl
                      ? () =>
                          setLightbox({
                            imageUrl: entry.imageUrl!.large,
                            sources: lightboxSourcesFor(entry.imageUrl),
                            name: entry.name,
                          })
                      : undefined
                  }
                />
                <div className={styles.missRow__body}>
                  <div className={styles.missRow__name}>{entry.name}</div>
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
