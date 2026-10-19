/**
 * Shared nav active-item resolution (FND-06).
 *
 * TopBar and BottomTabBar previously computed active state independently
 * with the same broken prefix-matching logic: `pathname.startsWith('/library')`
 * only matched `/library-csv-sources` by accident (a hyphen, not a slash,
 * follows the prefix), and neither activated Home on `/decks/*` or Library
 * on `/add-cards`. This explicit route map replaces both.
 */

export type TNavKey = 'home' | 'library' | 'lists' | 'chat';

const HOME_PATHS: readonly string[] = ['/home', '/decks/new'];
const HOME_PREFIXES: readonly string[] = ['/home/', '/decks/'];
const LIBRARY_PATHS: readonly string[] = ['/library', '/library-csv-sources'];
const LIBRARY_PREFIXES: readonly string[] = ['/add-cards'];
const LISTS_PATH = '/lists';
const CHAT_PATH = '/chat';

/**
 * Resolves which primary nav item (if any) should render as active for a
 * given pathname. `/decks/$deckId?edit=1` activates Home via the
 * `/decks/` prefix alone — edit mode is a search param, invisible here.
 * Unmatched paths (settings, about, onboarding, ...) resolve to `null`,
 * which is the correct default: the handoff only specifies which extra
 * pages count as Home/Library, not that every page highlights something.
 */
export function resolveActiveNavKey(pathname: string): TNavKey | null {
  if (
    HOME_PATHS.includes(pathname) ||
    HOME_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return 'home';
  }

  if (
    LIBRARY_PATHS.includes(pathname) ||
    LIBRARY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return 'library';
  }

  if (pathname === LISTS_PATH || pathname.startsWith(`${LISTS_PATH}/`)) {
    return 'lists';
  }

  if (pathname === CHAT_PATH || pathname.startsWith(`${CHAT_PATH}/`)) {
    return 'chat';
  }

  return null;
}
