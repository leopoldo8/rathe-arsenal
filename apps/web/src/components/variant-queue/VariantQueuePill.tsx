import React, { useEffect, useState } from 'react';
import { useVariantJobsQuery, hasActiveJobs } from '../../api/variant-jobs';
import { VariantQueueDrawer } from './VariantQueueDrawer';
import { subscribeOpenVariantQueueDrawer } from './variantQueueDrawerBus';
import QueueIcon from '../../assets/icons/queue.svg?react';
import styles from './VariantQueuePill.module.css';

/**
 * Navbar entry point for the price-fetch queue.
 *
 * Renders an icon button (with a status dot) whenever there are active or
 * recently-finished jobs, and opens the full-height queue drawer on click.
 * Self-hides when there is nothing to show.
 */
export function VariantQueuePill(): React.ReactElement | null {
  const { data } = useVariantJobsQuery();
  const [open, setOpen] = useState(false);

  // Pop open when a "Get exact prices" click elsewhere requests it.
  useEffect(() => subscribeOpenVariantQueueDrawer(() => setOpen(true)), []);

  if (!data || data.jobs.length === 0) return null;

  const active = hasActiveJobs(data);
  const anyFailed = data.jobs.some((j) => j.status === 'failed' || j.failed > 0);
  const status: 'active' | 'failed' | 'done' = active ? 'active' : anyFailed ? 'failed' : 'done';

  const activeCount = data.jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
  const label = active
    ? `Price fetch queue — ${activeCount} in progress`
    : anyFailed
      ? 'Price fetch queue — finished with errors'
      : 'Price fetch queue — done';

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.button}
        data-testid="variant-queue-pill"
        data-status={status}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <QueueIcon className={styles.icon} aria-hidden="true" />
        <span className={`${styles.dot} ${styles[status]}`} aria-hidden="true" />
      </button>
      <VariantQueueDrawer
        open={open}
        onClose={() => setOpen(false)}
        jobs={data.jobs}
        etaSeconds={data.etaSeconds}
      />
    </div>
  );
}
