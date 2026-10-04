import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SWAPS_LINK_SEARCH, type IDeckSummary, type TStripKind } from './deckDetailModel';
import styles from './DeckStatusStrip.module.css';

export const MISSING_PANEL_ID = 'deck-missing-panel';

interface IDeckStatusStripProps {
  readonly summary: IDeckSummary;
  readonly fabraryUlid: string | null;
}

const TONE_CLASS: Readonly<Record<TStripKind, string>> = {
  complete: styles.toneComplete ?? '',
  solvable: styles.toneSolvable ?? '',
  incomplete: styles.toneIncomplete ?? '',
};

function useStripMessage(summary: IDeckSummary): string {
  const { t } = useTranslation();
  if (summary.kind === 'complete') return t('deckDetail.stripComplete');
  if (summary.kind === 'solvable') {
    return t('deckDetail.stripSolvable', { count: summary.pendingSwaps });
  }

  const gap = t('deckDetail.stripMissingCards', { count: summary.missingCards });
  const progress: string[] = [];
  if (summary.approvedSwaps > 0) {
    progress.push(t('deckDetail.stripApplied', { count: summary.approvedSwaps }));
    if (summary.pendingSwaps > 0) {
      progress.push(t('deckDetail.stripWaiting', { count: summary.pendingSwaps }));
    }
    return `${gap} — ${progress.join(', ')}.`;
  }
  if (summary.pendingSwaps === 0) return `${gap} — ${t('deckDetail.stripNoSwaps')}.`;
  const closer = t('deckDetail.stripPendingCloser', { count: summary.pendingSwaps });
  const unsolved =
    summary.unsolvedCards > 0
      ? ` ${t('deckDetail.stripUnsolved', { count: summary.unsolvedCards })}`
      : '';
  return `${gap} — ${closer}${unsolved}.`;
}

export function DeckStatusStrip({ summary, fabraryUlid }: IDeckStatusStripProps): React.ReactElement {
  const { t } = useTranslation();
  const message = useStripMessage(summary);
  const hasSwaps = summary.pendingSwaps + summary.approvedSwaps > 0;
  const showSwapsLink = summary.kind !== 'complete' && hasSwaps;
  const showShoppingLink = summary.kind === 'incomplete' && summary.missingCards > 0;
  const showFabrary = summary.kind === 'incomplete' && fabraryUlid !== null;
  const stripClass = [styles.strip, TONE_CLASS[summary.kind]].join(' ');

  return (
    <section
      className={stripClass}
      aria-label={t('deckDetail.stripAria')}
      data-testid="deck-status-strip"
      data-kind={summary.kind}
    >
      <p className={styles.message} data-testid="deck-status-strip-message">
        {message}
      </p>
      {(showSwapsLink || showShoppingLink || showFabrary) && (
        <div className={styles.actions}>
          {showSwapsLink && (
            <Link to="/swaps" search={SWAPS_LINK_SEARCH} className={styles.action} data-testid="strip-view-swaps">
              {t('deckDetail.seeSwaps')}
            </Link>
          )}
          {showShoppingLink && (
            <a href={`#${MISSING_PANEL_ID}`} className={styles.action} data-testid="strip-view-shopping">
              {t('deckDetail.seeShopping')}
            </a>
          )}
          {showFabrary && (
            <a
              href={`https://fabrary.com/decks/${fabraryUlid}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fabrary}
              data-testid="deck-fabrary-link"
              aria-label={t('decks.viewOnFabraryAria')}
            >
              {t('decks.viewOnFabraryLink')}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
