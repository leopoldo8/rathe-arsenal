/**
 * T3 sanity test — i18n test harness helpers
 *
 * Verifies that:
 * - The global beforeEach in setup.ts resets the locale to pt-BR before each test
 * - setTestLocale switches i18n.language (and document.documentElement.lang)
 *
 * Spec AC covered: test determinism enabler for I18N-05 (extraction phase)
 */

import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../index';
import { setTestLocale } from '../../test/i18n-test-utils';

describe('i18n test harness', () => {
  afterEach(async () => {
    // Restore to pt-BR after each test so global beforeEach has a clean slate
    await setTestLocale('pt-BR');
  });

  it('global setup initialises i18n with pt-BR as the default locale', () => {
    // The global beforeEach in setup.ts calls changeLanguage('pt-BR') before
    // every test, so at this point i18n.language must be 'pt-BR'.
    expect(i18n.language).toBe('pt-BR');
  });

  it('setTestLocale("en-US") changes i18n.language to en-US', async () => {
    await setTestLocale('en-US');
    expect(i18n.language).toBe('en-US');
  });

  it('setTestLocale("en-US") also updates document.documentElement.lang', async () => {
    await setTestLocale('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('setTestLocale("pt-BR") changes i18n.language to pt-BR', async () => {
    await setTestLocale('pt-BR');
    expect(i18n.language).toBe('pt-BR');
  });
});
