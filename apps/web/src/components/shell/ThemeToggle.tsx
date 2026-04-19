import React, { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../ui/Toast/useToast';
import { patchUserSettings } from '../../api/user-settings';
import { THEME_STORAGE_KEY, TTheme, resolveTheme } from '../../styles/theme-init';
import styles from './ThemeToggle.module.css';

function getInitialTheme(): TTheme {
  return resolveTheme(document.documentElement.dataset.theme);
}

/**
 * ThemeToggle — toggle-group with sun (light) / moon (dark) buttons.
 *
 * On click:
 *  1. Optimistic: update `dataset.theme` + localStorage immediately (pre-hydration hint)
 *  2. PATCH /api/users/me/settings { theme } — server-persist
 *  3. On error: show toast with explicit divergence copy. localStorage stays updated —
 *     cross-device sync is best-effort, flash prevention is the hard requirement
 *     (plan §Key Technical Decisions). `console.error` surfaces the underlying error in
 *     browser devtools for dev diagnosis; a server-side error sink (Sentry or similar)
 *     is out of Plan A scope and planned as follow-up.
 */
export function ThemeToggle(): React.ReactElement {
  const [theme, setTheme] = useState<TTheme>(getInitialTheme);
  const auth = useAuth();
  const toast = useToast();

  function applyLocally(next: TTheme): void {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing — silent
    }
    auth.setSettings({ theme: next });
  }

  function handleThemeChange(value: string): void {
    if (value !== 'dark' && value !== 'light') return;
    const next = value as TTheme;
    applyLocally(next);

    patchUserSettings(next, auth.token).catch((err) => {
      // Server write failed. Per plan: localStorage stays updated (flash prevention
      // is the hard requirement); user gets explicit divergence copy so silent
      // cross-device desync doesn't accumulate.
      console.error('[theme-toggle] server PATCH failed', err);
      toast.show({
        kind: 'error',
        message: "Saved locally — didn't reach the server. Will retry on next change.",
      });
    });
  }

  return (
    <ToggleGroup.Root
      type="single"
      value={theme}
      onValueChange={handleThemeChange}
      aria-label="Theme"
      className={styles.root}
    >
      <ToggleGroup.Item
        value="light"
        aria-label="Light theme"
        className={styles.item}
        data-testid="theme-toggle-light"
      >
        {/* Sun icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </ToggleGroup.Item>
      <ToggleGroup.Item
        value="dark"
        aria-label="Dark theme"
        className={styles.item}
        data-testid="theme-toggle-dark"
      >
        {/* Moon icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
