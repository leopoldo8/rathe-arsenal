/**
 * Theme initialisation — pure-function utilities.
 *
 * The logic here is extracted from the inline IIFE in index.html so it can
 * be unit-tested without DOM manipulation. The IIFE calls resolveTheme()
 * directly and writes the result to dataset.theme.
 *
 * Whitelist check ALWAYS precedes DOM write — a tampered localStorage value
 * can never reach document.documentElement.dataset.theme.
 */

export const ALLOWED_THEMES = ['dark', 'light'] as const;
export type TTheme = (typeof ALLOWED_THEMES)[number];

export const THEME_STORAGE_KEY = 'rathe-arsenal:theme';

/**
 * Resolve which theme to apply given an arbitrary raw value from storage.
 *
 * Returns 'dark' for any input that is not in the allowed list, including
 * null (absent key) and any unknown string.
 */
export function resolveTheme(raw: string | null | undefined): TTheme {
  if (raw != null && (ALLOWED_THEMES as readonly string[]).includes(raw)) {
    return raw as TTheme;
  }
  return 'dark';
}
