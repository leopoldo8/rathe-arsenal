import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import type { IVariantJob } from '../../api/variant-jobs';
import { setCssVar } from '../../lib/dom/setCssVar';
import QueueIcon from '../../assets/icons/queue.svg?react';
import styles from './VariantQueueDrawer.module.css';

interface IVariantQueueDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly jobs: readonly IVariantJob[];
  readonly etaSeconds: number;
}

function progressPct(job: IVariantJob): number {
  if (job.total <= 0) return 0;
  return Math.round(((job.completed + job.failed) / job.total) * 100);
}

/**
 * Live progress bar. The fill width is driven by a CSS custom property set via
 * a ref because inline `style` is forbidden on DOM nodes (react/forbid-dom-props).
 */
function ProgressBar({ pct }: { pct: number }): React.ReactElement {
  const fillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setCssVar(fillRef.current, '--ra-progress', `${pct}%`);
  }, [pct]);
  return (
    <span className={styles.bar} aria-hidden="true">
      <span ref={fillRef} className={styles.barFill} />
    </span>
  );
}

function DeckLink({ job }: { job: IVariantJob }): React.ReactElement {
  return (
    <Link
      to="/decks/$deckId"
      params={{ deckId: String(job.deckId) }}
      search={{ edit: undefined }}
      className={styles.deckName}
    >
      {job.deckName}
    </Link>
  );
}

function QueuedRow({ job }: { job: IVariantJob }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <li className={`${styles.row} ${styles.queued}`}>
      <DeckLink job={job} />
      <span className={styles.meta}>{t('variantQueue.waitingCount', { count: job.total })}</span>
    </li>
  );
}

function RunningRow({ job }: { job: IVariantJob }): React.ReactElement {
  const pct = progressPct(job);
  return (
    <li className={`${styles.row} ${styles.running}`}>
      <div className={styles.rowHead}>
        <DeckLink job={job} />
        <span className={styles.count}>
          {job.completed + job.failed}/{job.total}
        </span>
      </div>
      <ProgressBar pct={pct} />
    </li>
  );
}

function CompletedRow({ job }: { job: IVariantJob }): React.ReactElement {
  const { t } = useTranslation();
  const isFailed = job.status === 'failed';
  const hasPartialFailures = job.failed > 0 && !isFailed;
  const tone = isFailed ? styles.error : hasPartialFailures ? styles.warn : styles.ok;
  const message = isFailed
    ? t('variantQueue.couldNotReachStore')
    : hasPartialFailures
      ? t('variantQueue.updatedAndFailed', { completed: job.completed, failed: job.failed })
      : t('variantQueue.pricesUpdated', { count: job.completed });
  return (
    <li className={`${styles.row} ${tone}`}>
      <div className={styles.rowHead}>
        <DeckLink job={job} />
        <span className={styles.statusGlyph} aria-hidden="true">{isFailed ? '✕' : '✓'}</span>
      </div>
      <span className={styles.meta}>{message}</span>
    </li>
  );
}

/**
 * Full-height right-side drawer listing every price-fetch job, grouped by
 * lifecycle: queued (waiting, dimmed) at the top, in-progress (live bars)
 * below, and recently completed/failed at the bottom. Mirrors the keyboard +
 * scroll-lock behavior of LibraryFilterDrawer.
 */
export function VariantQueueDrawer({
  open,
  onClose,
  jobs,
  etaSeconds,
}: IVariantQueueDrawerProps): React.ReactElement | null {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const queued = jobs.filter((j) => j.status === 'pending');
  const running = jobs.filter((j) => j.status === 'running');
  const completed = jobs.filter((j) => j.status === 'done' || j.status === 'failed' || j.status === 'canceled');
  const active = queued.length + running.length > 0;

  function formatEta(seconds: number): string {
    if (seconds <= 0) return t('variantQueue.almostDone');
    if (seconds < 60) return t('variantQueue.secondsLeft', { count: seconds });
    return t('variantQueue.minutesLeft', { count: Math.ceil(seconds / 60) });
  }

  return (
    <div className={styles.backdrop} onClick={onClose} data-testid="variant-queue-backdrop">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={t('variantQueue.drawerAria')}
        data-testid="variant-queue-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <QueueIcon className={styles.titleIcon} aria-hidden="true" />
            <div>
              <h2 className={styles.title}>{t('variantQueue.drawerTitle')}</h2>
              <p className={styles.subtitle}>
                {active ? formatEta(etaSeconds) : t('variantQueue.etaSubtitleFetching')}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('variantQueue.closeQueueAria')}
          >
            ✕
          </button>
        </header>

        <div className={styles.content}>
          {jobs.length === 0 && <p className={styles.empty}>{t('variantQueue.noPriceFetches')}</p>}

          {queued.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('variantQueue.sectionQueued')}</h3>
              <ul className={styles.list}>
                {queued.map((j) => <QueuedRow key={j.jobId} job={j} />)}
              </ul>
            </section>
          )}

          {running.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('variantQueue.sectionInProgress')}</h3>
              <ul className={styles.list}>
                {running.map((j) => <RunningRow key={j.jobId} job={j} />)}
              </ul>
            </section>
          )}

          {completed.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('variantQueue.sectionRecentlyCompleted')}</h3>
              <ul className={styles.list}>
                {completed.map((j) => <CompletedRow key={j.jobId} job={j} />)}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
