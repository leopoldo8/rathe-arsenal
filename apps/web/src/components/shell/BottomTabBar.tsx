import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_HOME_SEARCH } from '../../routes/_auth/-home.helpers';
import { useAuth } from '../../auth/useAuth';
import { TutorMark } from '../chat/TutorMark';
import { resolveActiveNavKey, type TNavKey } from './nav-active';
import styles from './BottomTabBar.module.css';

interface ITabItem {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly key: TNavKey;
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

function ListsIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

/**
 * BottomTabBar — fixed bottom navigation, visible only <960px.
 * Equal-width items with icon + short label.
 * Active state uses brass accent.
 */
export function BottomTabBar(): React.ReactElement {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '/';
  const activeNavKey = resolveActiveNavKey(pathname);
  const { user } = useAuth();

  // /home is handled separately with a typed Link+search prop.
  // /library uses a string-typed `to` so TypeScript does not enforce
  // its route-specific search params here — its validateSearch accepts empty.
  const otherTabItems: readonly ITabItem[] = [
    { to: '/library', label: t('shell.navLibrary'), icon: <LibraryIcon />, key: 'library' },
    { to: '/lists', label: t('shell.navLists'), icon: <ListsIcon />, key: 'lists' },
    ...(user?.chatAccess ? [{ to: '/chat', label: t('shell.navTutor'), icon: <TutorMark />, key: 'chat' as const }] : []),
  ];

  const homeActive = activeNavKey === 'home';

  return (
    <nav className={styles.nav} aria-label={t('shell.mobileNavAriaLabel')}>
      {/* /home needs explicit search prop for the U9 validateSearch */}
      <Link
        to="/home"
        search={DEFAULT_HOME_SEARCH}
        className={styles.tab}
        data-active={homeActive ? 'true' : undefined}
        aria-current={homeActive ? 'page' : undefined}
      >
        <span className={styles.icon}><HomeIcon /></span>
        <span className={styles.label}>{t('shell.navHome')}</span>
      </Link>

      {otherTabItems.map((item) => {
        const isActive = activeNavKey === item.key;
        return (
          <Link
            key={item.to}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={item.to as any}
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
