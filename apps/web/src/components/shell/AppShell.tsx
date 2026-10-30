import React, { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { GlossaryScope } from '../glossary/GlossaryScope';
import { TopBar } from './TopBar';
import { BottomTabBar } from './BottomTabBar';
import { Footer } from './Footer';
import styles from './AppShell.module.css';

interface IAppShellProps {
  readonly children: React.ReactNode;
  readonly fitViewport?: boolean;
  /** False draws the page alone, full screen, inside the same elements so it is not remounted when the chrome comes back. */
  readonly chrome?: boolean;
}

const MOBILE_BREAKPOINT_QUERY = '(max-width: 959px)';

/**
 * AppShell — authenticated layout wrapper.
 *
 * Renders:
 *  - TopBar (sticky header with wordmark/logo-mark, primary nav, theme toggle, user menu)
 *  - Main content area (<main>)
 *  - Footer (persistent fan-content disclaimer, DISC-01)
 *  - BottomTabBar (fixed bottom, only on <960px viewport)
 *
 * The primary nav inside TopBar is CSS-hidden <960px; the BottomTabBar is
 * rendered in JS based on a matchMedia check to avoid rendering the mobile nav
 * on wide viewports.
 */
export function AppShell({ children, fitViewport = false, chrome = true }: IAppShellProps): React.ReactElement {
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

  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className={chrome ? styles.shell : styles.bare} data-fit-viewport={fitViewport && chrome ? 'true' : undefined}>
      {chrome && <TopBar />}
      {/* A new scope per page, so a game word is explained once on each screen. */}
      <main className={chrome ? styles.main : styles.bare}>
        <GlossaryScope key={pathname}>{children}</GlossaryScope>
      </main>
      {chrome && <Footer />}
      {chrome && isMobile && <BottomTabBar />}
    </div>
  );
}
