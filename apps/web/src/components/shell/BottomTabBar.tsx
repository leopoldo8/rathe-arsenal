import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import styles from './BottomTabBar.module.css';

interface ITabItem {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
}

function HomeIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function LibraryIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ReviewsIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const TAB_ITEMS: readonly ITabItem[] = [
  { to: '/home', label: 'Home', icon: <HomeIcon /> },
  { to: '/library', label: 'Library', icon: <LibraryIcon /> },
  { to: '/swaps', label: 'Swaps', icon: <ReviewsIcon /> },
];

/**
 * BottomTabBar — fixed bottom navigation, visible only <960px.
 * 3 equal-width items with icon + short label.
 * Each item min-width 107px to fit 3 items at 320px viewport.
 * Active state uses brass accent.
 */
export function BottomTabBar(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '/';

  return (
    <nav className={styles.nav} aria-label="Mobile primary">
      {TAB_ITEMS.map((item) => {
        const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
        return (
          <Link
            key={item.to}
            to={item.to}
            className={styles.tab}
            data-active={isActive ? 'true' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
