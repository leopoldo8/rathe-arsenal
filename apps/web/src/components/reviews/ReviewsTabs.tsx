import React from 'react';
import { useTranslation } from 'react-i18next';
import * as RadixTabs from '@radix-ui/react-tabs';
import type { TReviewState } from '../../api/reviews';
import styles from './ReviewsTabs.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TTabValue = TReviewState | 'all';

interface ITabCounts {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly all: number;
}

interface IReviewsTabsProps {
  readonly value: TTabValue;
  readonly counts: ITabCounts;
  readonly onChange: (value: TTabValue) => void;
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsTabs — Radix Tabs wrapper for the Reviews page.
 *
 * Tab selection maps to the `?state=` URL param (managed by parent).
 * Each tab trigger shows a count badge with the number of rows in that state.
 *
 * Keyboard navigation: Left/Right arrow keys cycle through tabs (Radix default).
 */
export function ReviewsTabs({
  value,
  counts,
  onChange,
  children,
}: IReviewsTabsProps): React.ReactElement {
  const { t } = useTranslation();

  const tabs: ReadonlyArray<{ readonly value: TTabValue; readonly label: string }> = [
    { value: 'pending', label: t('reviews.tabPending') },
    { value: 'approved', label: t('reviews.tabApproved') },
    { value: 'rejected', label: t('reviews.tabRejected') },
    { value: 'all', label: t('reviews.tabAll') },
  ];

  function handleValueChange(v: string): void {
    onChange(v as TTabValue);
  }

  return (
    <RadixTabs.Root value={value} onValueChange={handleValueChange} className={styles.root}>
      <RadixTabs.List className={styles.tabList} aria-label={t('reviews.tabListAria')}>
        {tabs.map((tab) => {
          const count = counts[tab.value];
          return (
            <RadixTabs.Trigger
              key={tab.value}
              value={tab.value}
              className={styles.trigger}
              aria-label={`${tab.label} — ${count}`}
            >
              {tab.label}
              <span className={styles.badge} aria-hidden="true">
                {count}
              </span>
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>

      {/* Single content panel — the parent renders filtered rows based on active tab */}
      <RadixTabs.Content value={value} className={styles.content} forceMount>
        {children}
      </RadixTabs.Content>
    </RadixTabs.Root>
  );
}
