import { chromium } from 'playwright';

const NAVIGATION_TIMEOUT_MS = 30_000;
const VISIBLE_TIMEOUT_MS = 20_000;

/** The app root has drawn something: an empty root means the JavaScript bundle did not run. */
const APP_DREW_SOMETHING = '#root > *';
const DECK_LIST = '[data-testid="deck-list"]';

export interface IBrowserCheck {
  readonly baseUrl: string;
  readonly sessionToken: string | null;
  readonly deckId: number | null;
}

/**
 * Loads the SPA in a real Chromium: the signed-out landing page, then (with the session cookie) the
 * smoke deck's page. An uncaught script error on either page fails the check.
 */
export async function checkInBrowser(check: IBrowserCheck): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const scriptErrors: string[] = [];
    page.on('pageerror', (error) => scriptErrors.push(error.message));

    await page.goto(`${check.baseUrl}/`);
    await page.locator(APP_DREW_SOMETHING).first().waitFor({ state: 'visible', timeout: VISIBLE_TIMEOUT_MS });
    failOnScriptErrors(scriptErrors, '/');

    if (check.sessionToken === null || check.deckId === null) return;
    await context.addCookies([{ name: 'ra_session', value: check.sessionToken, url: check.baseUrl }]);
    await page.goto(`${check.baseUrl}/decks/${check.deckId}`);
    await page.locator(DECK_LIST).waitFor({ state: 'visible', timeout: VISIBLE_TIMEOUT_MS });
    failOnScriptErrors(scriptErrors, `/decks/${check.deckId}`);
  } finally {
    await browser.close();
  }
}

function failOnScriptErrors(errors: readonly string[], route: string): void {
  if (errors.length > 0) throw new Error(`the page ${route} raised an uncaught script error: ${errors[0]}`);
}
