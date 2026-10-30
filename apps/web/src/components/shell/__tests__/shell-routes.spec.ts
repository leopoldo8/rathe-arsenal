import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAuthShellPath, isFullScreenPath } from '../shell-routes';

/** Signed-in pages that only send the visitor elsewhere, so they never draw a shell. */
const REDIRECT_ONLY_PATHS = ['/reviews', '/swaps'];

/** Every address of a signed-in page, read from the generated route tree (the `_auth` layout's children). */
function signedInPaths(): string[] {
  const tree = readFileSync(path.resolve(__dirname, '../../../routeTree.gen.ts'), 'utf-8');
  const block = tree.slice(tree.indexOf('export interface FileRoutesByFullPath'), tree.indexOf('export interface FileRoutesByTo'));
  return [...block.matchAll(/'([^']+)': typeof (Auth\w+)Route/g)].map((match) => match[1] as string);
}

describe('the app shell covers every signed-in page', () => {
  it('finds the signed-in pages in the route tree', () => {
    const paths = signedInPaths();
    expect(paths).toContain('/home');
    expect(paths).toContain('/spare');
    expect(paths).toContain('/library-pending');
  });

  it.each(['/spare', '/library-pending'])('draws the top bar and footer on %s', (pathname) => {
    expect(isAuthShellPath(pathname)).toBe(true);
  });

  it('has a shell, or a full screen, or only a redirect, for each signed-in page', () => {
    const withoutShell = signedInPaths().filter(
      (pathname) => !isAuthShellPath(pathname) && !isFullScreenPath(pathname) && !REDIRECT_ONLY_PATHS.includes(pathname.replace(/\/$/, '')),
    );
    expect(withoutShell).toEqual([]);
  });

  it('keeps the card scanner full screen', () => {
    expect(isAuthShellPath('/add-cards/scan')).toBe(false);
    expect(isFullScreenPath('/add-cards/scan')).toBe(true);
  });

  it('does not draw the shell on the signed-out pages', () => {
    for (const pathname of ['/', '/entrar', '/about', '/termos', '/d/abc', '/l/abc']) {
      expect(isAuthShellPath(pathname)).toBe(false);
    }
  });
});
