import React, { useState } from 'react';
import { useVariantJobsQuery, hasActiveJobs } from '../../api/variant-jobs';
import { VariantQueuePanel } from './VariantQueuePanel';
import styles from './VariantQueuePill.module.css';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'done';
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.ceil(seconds / 60)}m`;
}

export function VariantQueuePill(): React.ReactElement | null {
  const { data } = useVariantJobsQuery();
  const [open, setOpen] = useState(false);
  if (!data || data.jobs.length === 0) return null;

  const total = data.jobs.reduce((s, j) => s + j.total, 0);
  const done = data.jobs.reduce((s, j) => s + j.completed + j.failed, 0);
  const active = hasActiveJobs(data);

  return (
    <div className={styles.root}>
      <button type="button" className={styles.pill} data-testid="variant-queue-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={active ? styles.spinner : styles.check} aria-hidden="true">{active ? '◐' : '✓'}</span>
        {done}/{total}{active ? ` · ${formatEta(data.etaSeconds)}` : ''}
      </button>
      {open && <VariantQueuePanel jobs={data.jobs} etaSeconds={data.etaSeconds} />}
    </div>
  );
}
