import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { VariantQueuePill } from '../variant-queue/VariantQueuePill';
import LogoMark from '../../assets/logo-mark.svg?react';
import { DEFAULT_HOME_SEARCH } from '../../routes/_auth/-home.helpers';
import styles from './TopBar.module.css';

interface INavItem {
  readonly to: string;
  readonly label: string;
}

// /home is handled separately below with a typed Link+search.
// /library and /swaps are kept as plain string `to` so TypeScript
// does not enforce their route-specific search params here — their
// validateSearch functions accept empty objects and apply defaults.
const OTHER_NAV_ITEMS: readonly INavItem[] = [
  { to: '/library', label: 'Library' },
  { to: '/swaps', label: 'Swaps' },
];

/**
 * TopBar — sticky top bar for the authenticated shell.
 *
 * Layout:
 *  - Left: wordmark (>=960px) or logo-mark (<960px) as Link to /home
 *  - Center: primary nav (Home / Library / Swaps)
 *  - Right: ThemeToggle + UserMenu
 *
 * Primary nav is hidden <960px (replaced by BottomTabBar in AppShell).
 */
export function TopBar(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '/';

  return (
    <header className={styles.header}>
      {/* Brand */}
      <Link to="/home" search={DEFAULT_HOME_SEARCH} className={styles.brand} aria-label="Rathe Arsenal home">
        <LogoMark className={styles.logoMark} aria-hidden="true" />
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.brandRathe}>Rathe</span>
          <span className={styles.brandArsenal}>Arsenal</span>
        </span>
      </Link>

      {/* Primary navigation — hidden <960px.
          /home is explicitly typed with search prop; other routes keep the
          string-typed `to` to avoid enforcing their search params here. */}
      <nav className={styles.nav} aria-label="Primary">
        <Link
          to="/home"
          search={DEFAULT_HOME_SEARCH}
          className={styles.navLink}
          data-active={pathname === '/home' || pathname.startsWith('/home/') ? 'true' : undefined}
        >
          Home
        </Link>
        {OTHER_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={item.to as any}
            className={styles.navLink}
            data-active={pathname === item.to || pathname.startsWith(item.to + '/') ? 'true' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right controls */}
      <div className={styles.controls}>
        <VariantQueuePill />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
