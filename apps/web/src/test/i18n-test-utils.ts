/**
 * i18n test utilities
 *
 * Re-exported by test files that need to assert locale-specific rendering.
 * All helpers resolve after the language change is fully committed so the
 * calling test can assert immediately after await.
 */

import i18n from '../i18n';

export type TTestLocale = 'pt-BR' | 'en-US';

/**
 * Switch the shared i18n instance to a specific locale for the duration of a
 * test. Use in beforeEach / inside each test case as needed.
 *
 * The global beforeEach in setup.ts resets to 'pt-BR' before every test, so
 * any switch made here is automatically reverted after the test completes.
 */
export async function setTestLocale(locale: TTestLocale): Promise<void> {
  await i18n.changeLanguage(locale);
}
