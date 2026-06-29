import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import { IBreakdown, IDecisionEntry } from '../../api/deck-detail';
import { SubstitutionRow, TDecisionState } from './SubstitutionRow';
import { groupSubstitutedEntries } from './BreakdownSections.helpers';
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
  const { t } = useTranslation();
  const notOwned = breakdown.notOwned ?? breakdown.missing;

  // Group identical substituted entries — one group per (original, slot, substitute).
  // SWAPGRP-02: renders one row per group; SWAPGRP-06: key includes substitute id.
  const subGroups = groupSubstitutedEntries(breakdown.substituted);

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
            {t('decks.exactMatches')}
          </h2>
          <span className={styles.section__count}>{t('decks.exactMatchesCount', { count: sumQuantities(breakdown.exact) })}</span>
        </div>

        {breakdown.exact.length === 0 ? (
          <p className={styles.section__empty}>{t('decks.noExactMatches')}</p>
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
            {t('decks.swaps')}
          </h2>
          <span className={styles.section__count}>
            {t('decks.activeSwapsCount', { count: subGroups.length })}
          </span>
        </div>

        {subGroups.length === 0 ? (
          <p className={styles.section__empty}>{t('decks.noSwapsNeeded')}</p>
        ) : (
          <ul className={styles.subList} aria-label={t('decks.swapProposalsAria')}>
            {subGroups.map((group) => {
              const { entry, count } = group;
              const subId = entry.match.substitute.cardIdentifier;
              const decision = resolveDecision(decisions, subId);
              return (
                <SubstitutionRow
                  key={`${entry.original.cardIdentifier}-${entry.original.slot}-${subId}`}
                  original={entry.original}
                  match={entry.match}
                  decision={decision}
                  onApprove={onApproveSubstitute}
                  onReject={onRejectSubstitute}
                  onReset={onResetSubstitute}
                  isPending={pendingSubstituteId === subId}
                  count={count}
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
            {t('decks.notOwned')}
          </h2>
          <span className={styles.section__count}>{t('decks.exactMatchesCount', { count: sumQuantities(notOwned) })}</span>
        </div>

        {notOwned.length === 0 ? (
          <div className={styles.emptyAllPlayable}>
            <p className={styles.emptyAllPlayable__title}>
              {t('decks.allPlayable')}
            </p>
            <p className={styles.emptyAllPlayable__sub}>
              {t('decks.collectionCoversAll')}
            </p>
          </div>
        ) : (
          <ul className={styles.missList} aria-label={t('decks.cardsNotInCollectionAria')}>
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
