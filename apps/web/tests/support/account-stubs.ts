import type { Page, Route } from '@playwright/test';

export const STUB_EMAIL = 'renata@cupuladt.com.br';

interface ICodeStubOptions {
  /** A real session for the app to carry on with once the stubbed sign-in succeeds. */
  readonly jwt: string;
  readonly email: string;
}

/**
 * Stubs the code sign-in routes the way the API behaves: each code request replaces the live code,
 * and only the live code signs in. Codes are handed back to the test, which reads them from the stub.
 */
export async function stubCodeSignIn(page: Page, options: ICodeStubOptions): Promise<{ readonly issued: string[] }> {
  const issued: string[] = [];
  const json = (route: Route, status: number, body: unknown): Promise<void> =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/auth/start', (route) => json(route, 200, { next: 'code' }));
  await page.route('**/api/auth/codes', (route) => {
    issued.push(String(111111 * (issued.length + 1)));
    return json(route, 202, { expiresAt: new Date(Date.now() + 900_000).toISOString(), resendAfter: new Date().toISOString() });
  });
  await page.route('**/api/auth/codes/verify', (route) => {
    const sent = (route.request().postDataJSON() as { code: string }).code;
    if (sent !== issued[issued.length - 1]) return json(route, 401, { code: 'INVALID_CODE', error: 'wrong' });
    return json(route, 200, {
      jwt: options.jwt,
      returnPath: null,
      user: { id: 'stub-user', email: options.email, role: 'user', chatAccess: false },
      settings: { theme: 'dark' },
    });
  });
  return { issued };
}
