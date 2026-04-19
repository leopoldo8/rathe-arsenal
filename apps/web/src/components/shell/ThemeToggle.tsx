import React, { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import styles from './ThemeToggle.module.css';

const STORAGE_KEY = 'rathe-arsenal:theme';

type TTheme = 'dark' | 'light';

function getInitialTheme(): TTheme {
  const stored = document.documentElement.dataset.theme;
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

/**
 * ThemeToggle — toggle-group with sun (light) / moon (dark) buttons.
 *
 * On click:
 *  1. Updates document.documentElement.dataset.theme
 *  2. Writes to localStorage['rathe-arsenal:theme']
 *  3. TODO(Unit 12): PATCH /api/users/me/settings { theme } — wired in Onda 3
 */
export function ThemeToggle(): React.ReactElement {
  const [theme, setTheme] = useState<TTheme>(getInitialTheme);

  function handleThemeChange(value: string): void {
    if (value !== 'dark' && value !== 'light') return;
    const next = value as TTheme;
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage might be unavailable in private browsing — fail silently
    }
    // TODO(Unit 12 / Onda 3): PATCH /api/users/me/settings { theme: next }
    // Replace this comment with the actual fetch call once Unit 12 lands.
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
