import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IBreakdownEntry, ISubstitutedEntry } from '../../api/deck-detail';
import type { IAlternativesTarget, IDeckReplacement } from '../../api/replacements';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import { cardName } from '../../lib/card-name';
import { MarkOwnedButton } from './MarkOwnedButton';
import { MissingRowBuy, MissingRowStoreMeta, MissingRowVariants } from './MissingRowStore';
import { MissingStoreSummary } from './MissingStoreSummary';
import { ReplacementMark } from './ReplacementMark';
import { SuggestionUseButton } from './SuggestionUseButton';
import { entryKey } from './deckDetailModel';
import { resolveRowStore } from './missingStoreModel';
import { MISSING_PANEL_ID } from './DeckStatusStrip';
import styles from './MissingPanel.module.css';

interface IMissingPanelProps {
  readonly entries: readonly IBreakdownEntry[];
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onShoppingRetry: () => void;
  /** Active replacements of the deck; a row for a replacement's own copies is marked and offers no alternatives. */
  readonly replacements?: readonly IDeckReplacement[];
  readonly onOpenAlternatives?: ((target: IAlternativesTarget) => void) | undefined;
  /** Opens the share dialog on the missing-cards link; the callout shows only when this is given. */
  readonly onShareMissing?: (() => void) | undefined;
  readonly deckId?: number;
  /** The collection's best card for each missing row, keyed by `entryKey`. */
  readonly suggestions?: ReadonlyMap<string, ISubstitutedEntry>;
}

/** Slots whose cards never get stand-ins, so they get no alternatives either. */
const NON_REPLACEABLE_SLOTS: ReadonlySet<string> = new Set(['hero', 'weapon']);

const PITCH_CLASS = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
} as const;

function pitchClass(pitch: IBreakdownEntry['pitch']): string {
  return pitch === null ? (styles.pitchNone ?? '') : PITCH_CLASS[pitch];
}

export function MissingPanel({
  entries,
  shoppingData,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onShoppingRetry,
  replacements = [],
  onOpenAlternatives,
  onShareMissing,
  deckId = 0,
  suggestions = new Map(),
}: IMissingPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const populated = shoppingData?.kind === 'populated' ? shoppingData : null;
  // Same test the rows use, so the number matches the rows marked as not in the store.
  const unavailableCopies = entries.reduce(
    (sum, entry) => (resolveRowStore(shoppingData, entry.cardIdentifier).kind === 'unavailable' ? sum + entry.quantity : sum),
    0,
  );

  return (
    <section
      id={MISSING_PANEL_ID}
      className={styles.panel}
      aria-labelledby="deck-missing-title"
      data-testid="deck-missing-panel"
    >
      <h2 id="deck-missing-title" className={styles.title}>
        {t('deckDetail.missingTitle')}
      </h2>
      {populated !== null && (
        <MissingStoreSummary data={populated} />
      )}
      {onShareMissing !== undefined && populated !== null && unavailableCopies > 0 && (
        <div className={styles.shareCallout} data-testid="missing-share-callout">
          <p className={styles.shareCalloutText}>{t('deckDetail.shareMissingCallout', { count: unavailableCopies })}</p>
          <button type="button" className={styles.shareCalloutBtn} onClick={onShareMissing} data-testid="missing-share-btn">
            {t('deckDetail.shareMissingAction')}
          </button>
        </div>
      )}
      {shoppingData?.kind === 'error' && (
        <div role="status" className={styles.storeError}>
          <span>{t('decks.shoppingUnavailable')}</span>
          <button type="button" onClick={onShoppingRetry} className={styles.retry}>
            {t('decks.retry')}
          </button>
        </div>
      )}
      {entries.length === 0 ? (
        <p className={styles.empty}>{t('deckDetail.missingEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const store = resolveRowStore(shoppingData, entry.cardIdentifier);
            const displayName = cardName(entry.name, entry.pitch, t);
            const held = replacements.filter(
              (replacement) =>
                replacement.replacementCardIdentifier === entry.cardIdentifier && replacement.slot === entry.slot,
            );
            const heldCopies = held.reduce((sum, replacement) => sum + replacement.quantity, 0);
            const suggestion = suggestions.get(entryKey(entry));
            const canReplace =
              onOpenAlternatives !== undefined &&
              !NON_REPLACEABLE_SLOTS.has(entry.slot) &&
              entry.quantity > heldCopies;
            return (
              <li key={entryKey(entry)} className={styles.row} data-testid="missing-row">
                <span className={`${styles.pitchBar} ${pitchClass(entry.pitch)}`} aria-hidden="true" />
                <div className={styles.body}>
                  <span className={styles.name}>{displayName}</span>
                  {held[0] !== undefined && <ReplacementMark replacement={held[0]} />}
                  {suggestion !== undefined && (
                    <span className={styles.suggestion} data-testid="missing-row-suggestion">
                      <span className={styles.suggestionName}>
                        {cardName(suggestion.match.substitute.name, suggestion.match.substitute.pitch, t)}
                      </span>
                      <span>{t('deckDetail.suggestionFrom')}</span>
                    </span>
                  )}

                  <span className={styles.meta} data-testid="missing-row-meta">
                    {entry.slot !== 'mainboard' && (
                      <span>{t(`deckDetail.slot.${entry.slot}`, { defaultValue: entry.slot })} </span>
                    )}
                    <MissingRowStoreMeta
                      store={store}
                      storeName={populated?.storeName ?? ''}
                    />
                  </span>
                </div>
                <span className={styles.qty}>{t('deckDetail.missingCopies', { count: entry.quantity })}</span>
                <span className={styles.action}>
                  <MissingRowBuy store={store} cardName={displayName} />
                  {suggestion !== undefined && (
                    <SuggestionUseButton deckId={deckId} entry={entry} suggestion={suggestion} />
                  )}
                  {canReplace && (
                    <button
                      type="button"
                      className={styles.alternatives}
                      aria-label={t('alternatives.openAria', { name: displayName })}
                      onClick={() =>
                        onOpenAlternatives({ cardIdentifier: entry.cardIdentifier, name: entry.name, slot: entry.slot })
                      }
                    >
                      {t('alternatives.open')}
                    </button>
                  )}
                </span>
                <span className={styles.owned}>
                  <MarkOwnedButton
                    cardIdentifier={entry.cardIdentifier}
                    name={entry.name}
                    pitch={entry.pitch}
                    onMarkOwned={onMarkOwned}
                    isPending={isMarkingOwned}
                    pendingCard={pendingCard}
                  />
                </span>
                <MissingRowVariants store={store} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
