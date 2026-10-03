import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IDecisionEntry, ISubstitutedEntry } from '../../api/deck-detail';
import { CardArt } from '../card-art/CardArt';
import {
  entryKey,
  resolveScoreBand,
  SWAPS_LINK_SEARCH,
  swapDecision,
  type TSwapDecision,
} from './deckDetailModel';
import styles from './SwapsPanel.module.css';

interface ISwapsPanelProps {
  readonly swaps: readonly ISubstitutedEntry[];
  readonly decisions: readonly IDecisionEntry[];
  readonly pendingSubstituteId: string | null;
  readonly onApprove: (substituteIdentifier: string) => void;
  readonly onReject: (substituteIdentifier: string) => void;
  readonly onReset: (substituteIdentifier: string) => void;
}

const BAND_CLASS = {
  high: styles.bandHigh ?? '',
  mid: styles.bandMid ?? '',
  low: styles.bandLow ?? '',
} as const;

interface ISwapCardProps {
  readonly swap: ISubstitutedEntry;
  readonly decision: TSwapDecision;
  readonly isBusy: boolean;
  readonly onApprove: (substituteIdentifier: string) => void;
  readonly onReject: (substituteIdentifier: string) => void;
  readonly onReset: (substituteIdentifier: string) => void;
}

function SwapCard({ swap, decision, isBusy, onApprove, onReject, onReset }: ISwapCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { original, match } = swap;
  const substituteId = match.substitute.cardIdentifier;
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
              disabled={isBusy}
              onClick={() => onApprove(substituteId)}
            >
              <span aria-hidden="true">&#10003;</span>
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.reject}`}
              aria-label={t('deckDetail.swapRejectAria', names)}
              disabled={isBusy}
              onClick={() => onReject(substituteId)}
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
              disabled={isBusy}
              onClick={() => onReset(substituteId)}
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
  decisions,
  pendingSubstituteId,
  onApprove,
  onReject,
  onReset,
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
          {swaps.map((swap) => (
            <SwapCard
              key={entryKey(swap.original)}
              swap={swap}
              decision={swapDecision(swap, decisions)}
              isBusy={pendingSubstituteId === swap.match.substitute.cardIdentifier}
              onApprove={onApprove}
              onReject={onReject}
              onReset={onReset}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
