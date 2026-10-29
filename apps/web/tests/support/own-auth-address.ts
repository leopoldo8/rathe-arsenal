import type { BrowserContext } from '@playwright/test';

/**
 * Password sign-in is limited to 5 a minute and sign-up to 20 an hour per caller address, and every
 * test of a run (and of the runs before it) shares the address of this machine, so one test's calls
 * can use up another's. The API reads the address from X-Forwarded-For (it sits behind a proxy in
 * production), so a context that sends its own gets windows of its own. No limit is relaxed.
 */
const addresses = new WeakMap<BrowserContext, string>();

function randomOctet(): number {
  return 1 + Math.floor(Math.random() * 254);
}

/** Makes every browser sign-in and sign-up of the context come from an address nobody else uses. */
export async function giveOwnAuthAddress(context: BrowserContext): Promise<void> {
  const address = `10.${randomOctet()}.${randomOctet()}.${randomOctet()}`;
  addresses.set(context, address);
  await context.route('**/api/auth/{sign-in,sign-up}', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': address } }),
  );
}

/** The header to put on a sign-in or sign-up sent with `context.request` or `page.request`, which routes do not touch. */
export function ownAuthHeaders(context: BrowserContext): Record<string, string> {
  const address = addresses.get(context);
  return address === undefined ? {} : { 'X-Forwarded-For': address };
}
