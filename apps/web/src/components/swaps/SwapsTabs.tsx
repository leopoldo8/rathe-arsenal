import React from 'react';
import { useTranslation } from 'react-i18next';
import * as RadixTabs from '@radix-ui/react-tabs';
import type { TSwapTab } from '../../api/swaps';
import styles from './SwapsTabs.module.css';

export type TTabValue = TSwapTab | 'all';

interface ITabCounts {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly all: number;
}

interface ISwapsTabsProps {
  readonly value: TTabValue;
  readonly counts: ITabCounts;
  readonly onChange: (value: TTabValue) => void;
  readonly children: React.ReactNode;
}

const HINT_KEYS = {
  pending: 'swaps.tabHintPending',
  approved: 'swaps.tabHintApproved',
  rejected: 'swaps.tabHintRejected',
  all: 'swaps.tabHintAll',
} as const;

export function SwapsTabs({
  value,
  counts,
  onChange,
  children,
}: ISwapsTabsProps): React.ReactElement {
  const { t } = useTranslation();

  const tabs: ReadonlyArray<{ readonly value: TTabValue; readonly label: string }> = [
    { value: 'pending', label: t('swaps.tabPending') },
    { value: 'approved', label: t('swaps.tabApproved') },
    { value: 'rejected', label: t('swaps.tabRejected') },
    { value: 'all', label: t('swaps.tabAll') },
  ];

  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(next) => onChange(next as TTabValue)}
      className={styles.root}
    >
      <RadixTabs.List className={styles.tabList} aria-label={t('swaps.tabListAria')}>
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={styles.trigger}
            aria-label={`${tab.label} — ${counts[tab.value]}`}
          >
            {tab.label}
            <span className={styles.badge} aria-hidden="true">
              {counts[tab.value]}
            </span>
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      <p className={styles.hint} data-testid="swaps-tab-hint">
        {t(HINT_KEYS[value])}
      </p>

      {/* One panel for every tab; the parent renders the rows for the active tab. */}
      <RadixTabs.Content value={value} className={styles.content} forceMount>
        {children}
      </RadixTabs.Content>
    </RadixTabs.Root>
  );
}
