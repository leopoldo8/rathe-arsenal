import React from 'react';
import { Link } from '@tanstack/react-router';
import type { IVariantJob } from '../../api/variant-jobs';
import styles from './VariantQueuePanel.module.css';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'done';
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.ceil(seconds / 60)} min`;
}

export function VariantQueuePanel({ jobs, etaSeconds }: { jobs: readonly IVariantJob[]; etaSeconds: number }): React.ReactElement {
  return (
    <div className={styles.panel} data-testid="variant-queue-panel" role="status" aria-live="polite">
      <ul className={styles.list}>
        {jobs.map((j) => {
          const pct = j.total > 0 ? Math.round(((j.completed + j.failed) / j.total) * 100) : 0;
          return (
            <li key={j.jobId} className={styles.row}>
              <Link to="/decks/$deckId" params={{ deckId: String(j.deckId) }} search={{ edit: undefined }} className={styles.deckName}>{j.deckName}</Link>
              <span className={styles.bar}><span className={styles.barFill} style={{ width: `${pct}%` }} /></span>
              <span className={styles.count}>{j.completed}/{j.total}{j.failed > 0 ? ` (${j.failed} failed)` : ''}</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.eta}>ETA {formatEta(etaSeconds)}</p>
    </div>
  );
}
