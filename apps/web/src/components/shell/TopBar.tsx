import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '/';

  // /home is handled separately below with a typed Link+search.
  // /library and /swaps are kept as plain string `to` so TypeScript
  // does not enforce their route-specific search params here — their
  // validateSearch functions accept empty objects and apply defaults.
  const otherNavItems: readonly INavItem[] = [
    { to: '/library', label: t('shell.navLibrary') },
    { to: '/swaps', label: t('shell.navSwaps') },
  ];

  return (
    <header className={styles.header}>
      {/* Brand */}
      <Link to="/home" search={DEFAULT_HOME_SEARCH} className={styles.brand} aria-label={t('shell.brandAriaLabel')}>
        <LogoMark className={styles.logoMark} aria-hidden="true" />
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.brandRathe}>Rathe</span>
          <span className={styles.brandArsenal}>Arsenal</span>
        </span>
      </Link>

      {/* Primary navigation — hidden <960px.
          /home is explicitly typed with search prop; other routes keep the
          string-typed `to` to avoid enforcing their search params here. */}
      <nav className={styles.nav} aria-label={t('shell.primaryNavAriaLabel')}>
        <Link
          to="/home"
          search={DEFAULT_HOME_SEARCH}
          className={styles.navLink}
          data-active={pathname === '/home' || pathname.startsWith('/home/') ? 'true' : undefined}
        >
          {t('shell.navHome')}
        </Link>
        {otherNavItems.map((item) => (
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
