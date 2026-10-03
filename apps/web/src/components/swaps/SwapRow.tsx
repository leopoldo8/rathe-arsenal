import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import type { ISwapImageUrl, ISwapRow, TSwapOutcome } from '../../api/swaps';
import { resolveConfidenceBand } from '../../routes/_auth/-swaps.helpers';
import { SwapOutcomeBar } from './SwapOutcomeBar';
import { SwapRejectPanel } from './SwapRejectPanel';
import type { IRejectSubmission } from './SwapRejectPanel';
import styles from './SwapRow.module.css';

export type TResolvedSwap = 'approved' | 'rejected';

const THUMB_WIDTH_PX = 34;

const BAND_CLASS = {
  high: styles.bandHigh,
  mid: styles.bandMid,
  low: styles.bandLow,
} as const;

interface ISwapRowProps {
  readonly row: ISwapRow;
  readonly resolved: TResolvedSwap | null;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly onToggleSelect: (id: string) => void;
  readonly onApprove: (row: ISwapRow) => Promise<boolean>;
  readonly onReject: (row: ISwapRow, submission: IRejectSubmission) => Promise<boolean>;
  readonly onRevert: (row: ISwapRow) => Promise<boolean>;
  readonly onRestore: (row: ISwapRow) => Promise<boolean>;
  readonly onUndo: (row: ISwapRow, resolved: TResolvedSwap) => Promise<boolean>;
  readonly onOutcome: (row: ISwapRow, outcome: TSwapOutcome) => Promise<boolean>;
}

const PITCH_KEYS = { 1: 'swaps.pitch.red', 2: 'swaps.pitch.yellow', 3: 'swaps.pitch.blue' } as const;

function buildSlotLine(row: ISwapRow, t: TFunction): string {
  const parts: string[] = [];
  if (row.originalType !== '' && row.originalType !== 'unknown') parts.push(row.originalType);
  if (row.originalPitch !== null) parts.push(t(PITCH_KEYS[row.originalPitch]));
  if (row.slot !== 'mainboard' || parts.length === 0) {
    parts.push(t(`swaps.slot.${row.slot}`, { defaultValue: row.slot }));
  }
  return parts.join(' · ');
}

interface ILightboxState {
  readonly imageUrl: string;
  readonly sources: readonly string[];
  readonly name: string;
}

export function SwapRow({
  row,
  resolved,
  isSelected,
  isBusy,
  onToggleSelect,
  onApprove,
  onReject,
  onRevert,
  onRestore,
  onUndo,
  onOutcome,
}: ISwapRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [isRejecting, setIsRejecting] = useState(false);
  const [lightbox, setLightbox] = useState<ILightboxState | null>(null);

  const isRejected = row.status === 'rejected';
  const isApplied = row.status === 'approved';
  const band = resolveConfidenceBand(row.confidence);
  const names = {
    original: row.originalName,
    substitute: row.substituteName,
    count: row.quantity,
  };
  const scope = (single: string, group: string): string =>
    row.quantity > 1 ? t(group, { count: row.quantity }) : t(single);

  function openLightbox(image: ISwapImageUrl | null, name: string): (() => void) | undefined {
    if (!image) return undefined;
    return () => setLightbox({ imageUrl: image.large, sources: lightboxSourcesFor(image), name });
  }

  async function submitRejection(submission: IRejectSubmission): Promise<void> {
    if (await onReject(row, submission)) setIsRejecting(false);
  }

  const slotLine = buildSlotLine(row, t);
  const reasonLabel = row.rejectionReason ? t(`swaps.rejectionReason.${row.rejectionReason}`) : null;

  return (
    <article
      className={`${styles.row} ${isRejected && !resolved ? styles.rowRejected : ''} ${
        isSelected ? styles.rowSelected : ''
      }`}
      data-testid="swap-row"
      data-row-id={row.id}
      data-status={row.status}
    >
      <div className={styles.main}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(row.id)}
          aria-label={t('swaps.selectAria', names)}
        />

        <div className={styles.deckCol}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(row.trackedDeckId) }}
            search={{ edit: undefined }}
            className={styles.deckName}
            aria-label={t('swaps.viewDeckAria', { deck: row.deckName })}
          >
            {row.deckName}
          </Link>
          <span className={styles.slot}>{slotLine}</span>
        </div>

        <div className={styles.pair} role="group" aria-label={t('swaps.pairAria', names)}>
          <div className={styles.side}>
            <span className={styles.thumbOut}>
              <CardArt
                name={row.originalName}
                pitch={row.originalPitch}
                cost={null}
                type={row.originalType}
                missing={false}
                size="xs"
                widthOverride={THUMB_WIDTH_PX}
                imageUrl={row.originalImageUrl}
                onClick={openLightbox(row.originalImageUrl, row.originalName)}
              />
            </span>
            <span className={styles.nameOut}>{row.originalName}</span>
          </div>
          <span className={styles.arrow} aria-hidden="true">
            &rarr;
          </span>
          <div className={styles.side}>
            <span className={styles.thumbIn}>
              <CardArt
                name={row.substituteName}
                pitch={row.substitutePitch}
                cost={null}
                type={row.substituteType}
                missing={false}
                size="xs"
                widthOverride={THUMB_WIDTH_PX}
                imageUrl={row.substituteImageUrl}
                onClick={openLightbox(row.substituteImageUrl, row.substituteName)}
              />
            </span>
            <span className={styles.nameIn}>
              {row.substituteName}
              {row.quantity > 1 && (
                <span
                  className={styles.copiesBadge}
                  aria-label={t('swaps.copiesBadgeAria', { count: row.quantity })}
                >
                  {t('swaps.copiesBadge', { count: row.quantity })}
                </span>
              )}
              <span className={styles.owned}>
                {row.ownedCount > 0
                  ? t('swaps.ownedCount', { count: row.ownedCount })
                  : t('swaps.ownedNone')}
              </span>
            </span>
          </div>
        </div>

        <div className={styles.confidenceCol}>
          <span className={styles.confidenceLabel}>{t('swaps.confidenceLabel')}</span>
          <span
            className={`${styles.confidence} ${BAND_CLASS[band]}`}
            data-band={band}
            aria-label={t('swaps.confidenceAria', { pct: `${row.confidence}%` })}
          >
            {row.confidence}%
          </span>
          <span className={styles.tier}>{t('swaps.tierCheckboxLabel', { tier: row.tier })}</span>
        </div>

        <div className={styles.actions}>
          {resolved ? (
            <>
              <span
                className={`${styles.confirmation} ${
                  resolved === 'approved' ? styles.confirmationApproved : styles.confirmationRejected
                }`}
                role="status"
              >
                {t(resolved === 'approved' ? 'swaps.resolvedApproved' : 'swaps.resolvedRejected')}
              </span>
              <button
                type="button"
                className={styles.ghost}
                disabled={isBusy}
                aria-label={t('swaps.undoAria', names)}
                onClick={() => void onUndo(row, resolved)}
              >
                {t('swaps.undo')}
              </button>
            </>
          ) : row.status === 'pending' ? (
            <>
              <button
                type="button"
                className={styles.approve}
                disabled={isBusy}
                aria-label={t('swaps.approveAria', names)}
                onClick={() => void onApprove(row)}
              >
                {scope('swaps.approve', 'swaps.approveGroup')}
              </button>
              <button
                type="button"
                className={styles.ghost}
                disabled={isBusy}
                aria-expanded={isRejecting}
                aria-label={t('swaps.rejectAria', names)}
                onClick={() => setIsRejecting(true)}
              >
                {scope('swaps.reject', 'swaps.rejectGroup')}
              </button>
            </>
          ) : isApplied ? (
            <>
              {row.appliedAt && (
                <span className={styles.elapsed}>{t('swaps.appliedSince', { date: row.appliedAt })}</span>
              )}
              <button
                type="button"
                className={styles.ghost}
                disabled={isBusy}
                aria-label={t('swaps.revertAria', names)}
                onClick={() => void onRevert(row)}
              >
                {scope('swaps.revert', 'swaps.revertGroup')}
              </button>
            </>
          ) : (
            <>
              <div className={styles.rejectedMeta}>
                <span className={styles.elapsed}>
                  {reasonLabel && (
                    <span className={styles.quote}>{t('swaps.rejectionQuote', { reason: reasonLabel })} </span>
                  )}
                  {row.rejectedAt && t('swaps.rejectedSince', { date: row.rejectedAt })}
                </span>
                {row.rejectionNote && <span className={styles.note}>{row.rejectionNote}</span>}
              </div>
              <button
                type="button"
                className={styles.ghost}
                disabled={isBusy}
                aria-label={t('swaps.restoreAria', names)}
                onClick={() => void onRestore(row)}
              >
                {scope('swaps.restore', 'swaps.restoreGroup')}
              </button>
            </>
          )}
        </div>
      </div>

      {row.rationale !== '' && <p className={styles.rationale}>{row.rationale}</p>}

      {isRejecting && !resolved && (
        <SwapRejectPanel
          isBusy={isBusy}
          onSubmit={(submission) => void submitRejection(submission)}
          onCancel={() => setIsRejecting(false)}
        />
      )}

      {isApplied && !resolved && (
        <SwapOutcomeBar
          outcome={row.outcome}
          isBusy={isBusy}
          onChange={(outcome) => void onOutcome(row, outcome)}
        />
      )}

      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </article>
  );
}
