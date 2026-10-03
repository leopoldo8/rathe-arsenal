import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ISubstitutedEntry } from '../../api/deck-detail';
import { findSwap } from '../../api/swaps';
import type { ISwapRow } from '../../api/swaps';
import { CardArt } from '../card-art/CardArt';
import {
  entryKey,
  resolveScoreBand,
  SWAPS_LINK_SEARCH,
  swapDecision,
  swapKeyOf,
  type TSwapDecision,
} from './deckDetailModel';
import styles from './SwapsPanel.module.css';

interface ISwapsPanelProps {
  readonly swaps: readonly ISubstitutedEntry[];
  readonly deckSwaps: readonly ISwapRow[];
  readonly pendingSwapId: string | null;
  readonly onApprove: (swapId: string) => void;
  readonly onReject: (swapId: string) => void;
  readonly onUndo: (swapId: string, decision: 'approved' | 'rejected') => void;
}

const BAND_CLASS = {
  high: styles.bandHigh ?? '',
  mid: styles.bandMid ?? '',
  low: styles.bandLow ?? '',
} as const;

interface ISwapCardProps {
  readonly swap: ISubstitutedEntry;
  readonly swapId: string | null;
  readonly decision: TSwapDecision;
  readonly isBusy: boolean;
  readonly onApprove: (swapId: string) => void;
  readonly onReject: (swapId: string) => void;
  readonly onUndo: (swapId: string, decision: 'approved' | 'rejected') => void;
}

function SwapCard({ swap, swapId, decision, isBusy, onApprove, onReject, onUndo }: ISwapCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { original, match } = swap;
  const isDisabled = isBusy || swapId === null;
  const scorePercent = Math.round(match.score * 100);
  const names = { original: original.name, substitute: match.substitute.name };

  return (
    <li className={styles.card} data-testid="swap-card" data-decision={decision}>
      <div className={styles.pair}>
        <span className={styles.thumbOriginal}>
          <CardArt
            name={original.name}
            pitch={original.pitch}
            cost={original.cost}
            type={original.type}
            missing={false}
            size="xs"
            imageUrl={original.imageUrl}
          />
        </span>
        <span className={styles.originalName}>{original.name}</span>
        <span className={styles.arrow} aria-hidden="true">
          &rarr;
        </span>
        <span className={styles.thumbSubstitute}>
          <CardArt
            name={match.substitute.name}
            pitch={null}
            cost={null}
            type={original.type}
            missing={false}
            size="xs"
            imageUrl={match.substitute.imageUrl}
          />
        </span>
        <span className={styles.substituteName}>{match.substitute.name}</span>
      </div>
      <div className={styles.footer}>
        <span
          className={`${styles.confidence} ${BAND_CLASS[resolveScoreBand(scorePercent)]}`}
          data-testid="swap-confidence"
          data-band={resolveScoreBand(scorePercent)}
        >
          {t('deckDetail.swapHave', { count: original.quantity, score: scorePercent })}
        </span>
        {decision === 'pending' ? (
          <span className={styles.buttons}>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.approve}`}
              aria-label={t('deckDetail.swapApproveAria', names)}
              disabled={isDisabled}
              onClick={() => swapId !== null && onApprove(swapId)}
            >
              <span aria-hidden="true">&#10003;</span>
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.reject}`}
              aria-label={t('deckDetail.swapRejectAria', names)}
              disabled={isDisabled}
              onClick={() => swapId !== null && onReject(swapId)}
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          </span>
        ) : (
          <span className={styles.buttons}>
            <span className={styles.decided}>
              {decision === 'approved' ? t('deckDetail.swapApplied') : t('deckDetail.swapRejected')}
            </span>
            <button
              type="button"
              className={styles.undo}
              aria-label={t('deckDetail.swapUndoAria', names)}
              disabled={isDisabled}
              onClick={() => swapId !== null && onUndo(swapId, decision)}
            >
              {t('deckDetail.swapUndo')}
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

export function SwapsPanel({
  swaps,
  deckSwaps,
  pendingSwapId,
  onApprove,
  onReject,
  onUndo,
}: ISwapsPanelProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section className={styles.panel} aria-labelledby="deck-swaps-title" data-testid="deck-swaps-panel">
      <div className={styles.header}>
        <h2 id="deck-swaps-title" className={styles.title}>
          {t('deckDetail.swapsTitle')}
        </h2>
        <Link to="/swaps" search={SWAPS_LINK_SEARCH} className={styles.viewAll} data-testid="swaps-view-all">
          {t('deckDetail.swapsViewAll')}
        </Link>
      </div>
      {swaps.length === 0 ? (
        <p className={styles.empty}>{t('deckDetail.swapsEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {swaps.map((swap) => {
            const swapId = findSwap(deckSwaps, swapKeyOf(swap))?.id ?? null;
            return (
              <SwapCard
                key={entryKey(swap.original)}
                swap={swap}
                swapId={swapId}
                decision={swapDecision(swap, deckSwaps)}
                isBusy={swapId !== null && pendingSwapId === swapId}
                onApprove={onApprove}
                onReject={onReject}
                onUndo={onUndo}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
