import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import LogoWordmark from '../../assets/logo-wordmark.svg?react';
import LogoMark from '../../assets/logo-mark.svg?react';
import styles from './TopBar.module.css';

interface INavItem {
  readonly to: string;
  readonly label: string;
}

const NAV_ITEMS: readonly INavItem[] = [
  { to: '/home', label: 'Home' },
  { to: '/library', label: 'Library' },
  { to: '/reviews', label: 'Reviews' },
];

/**
 * TopBar — sticky top bar for the authenticated shell.
 *
 * Layout:
 *  - Left: wordmark (>=960px) or logo-mark (<960px) as Link to /home
 *  - Center: primary nav (Home / Library / Reviews)
 *  - Right: ThemeToggle + UserMenu
 *
 * Primary nav is hidden <960px (replaced by BottomTabBar in AppShell).
 */
export function TopBar(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '/';

  return (
    <header className={styles.header}>
      {/* Brand */}
      <Link to="/home" className={styles.brand} aria-label="Rathe Arsenal home">
        <LogoMark className={styles.logoMark} aria-hidden="true" />
        <LogoWordmark className={styles.logoWordmark} aria-hidden="true" />
      </Link>

      {/* Primary navigation — hidden <960px */}
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.navLink}
            data-active={pathname === item.to || pathname.startsWith(item.to + '/') ? 'true' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right controls */}
      <div className={styles.controls}>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
