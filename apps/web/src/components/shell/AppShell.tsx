import React, { useEffect, useState } from 'react';
import { TopBar } from './TopBar';
import { BottomTabBar } from './BottomTabBar';
import styles from './AppShell.module.css';

interface IAppShellProps {
  readonly children: React.ReactNode;
}

const MOBILE_BREAKPOINT_QUERY = '(max-width: 959px)';

/**
 * AppShell — authenticated layout wrapper.
 *
 * Renders:
 *  - TopBar (sticky header with wordmark/logo-mark, primary nav, theme toggle, user menu)
 *  - Main content area (<main>)
 *  - BottomTabBar (fixed bottom, only on <960px viewport)
 *
 * The primary nav inside TopBar is CSS-hidden <960px; the BottomTabBar is
 * rendered in JS based on a matchMedia check to avoid rendering the mobile nav
 * on wide viewports.
 */
export function AppShell({ children }: IAppShellProps): React.ReactElement {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handler = (e: MediaQueryListEvent): void => {
      setIsMobile(e.matches);
    };
    // Modern browsers
    mql.addEventListener('change', handler);
    // Sync on mount in case SSR initial state differed
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.main}>{children}</main>
      {isMobile && <BottomTabBar />}
    </div>
  );
}
