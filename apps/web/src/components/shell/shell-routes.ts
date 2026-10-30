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

/**
 * Signed-in pages whose approved phone design is a focused full-screen page (its own back link and
 * sticky bar), so on a phone they draw no top bar, footer or tab bar. From desktop width they get the shell.
 */
export const PHONE_FOCUSED_PATHS: readonly string[] = ['/spare', '/library-pending'];

/** Width where the desktop layout starts; the same threshold the shell uses to drop the tab bar. */
export const DESKTOP_MIN_WIDTH_PX = 960;

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

export function isPhoneFocusedPath(pathname: string): boolean {
  return PHONE_FOCUSED_PATHS.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Whether the shell wraps the page at this width. */
export function drawsShell(pathname: string, isPhone: boolean): boolean {
  if (!isAuthShellPath(pathname)) return false;
  return !(isPhone && isPhoneFocusedPath(pathname));
}
