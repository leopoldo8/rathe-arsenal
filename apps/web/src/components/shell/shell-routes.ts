/** Pages of the signed-in app that render inside the app shell (top bar, footer, bottom tab bar). */
export const AUTH_SHELL_PREFIXES: readonly string[] = [
  '/home',
  '/library',
  '/library-csv-sources',
  '/library-pending',
  '/lists',
  '/add-cards',
  '/settings',
  '/decks',
  '/onboarding',
  '/chat',
  '/spare',
];

/** Signed-in pages that take the whole screen; checked before the shell prefixes. */
export const FULL_SCREEN_PATHS: readonly string[] = ['/add-cards/scan'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isFullScreenPath(pathname: string): boolean {
  return FULL_SCREEN_PATHS.includes(pathname);
}

/** True for any address under the signed-in app, including the full-screen pages. */
export function isSignedInAppPath(pathname: string): boolean {
  return AUTH_SHELL_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAuthShellPath(pathname: string): boolean {
  return !isFullScreenPath(pathname) && isSignedInAppPath(pathname);
}
