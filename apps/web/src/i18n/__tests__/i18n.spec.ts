/**
 * T2: i18next bootstrap unit tests
 *
 * Spec ACs covered:
 *  - P1-AC1/AC2: language detection + PT-BR/EN-US resolution
 *  - P1-AC6: languageChanged → document.documentElement.lang
 *  - P1-AC7: missing-key fallback — config (fallbackLng: 'pt-BR') AND the
 *    runtime behaviour (a key missing from the active locale resolves to its
 *    pt-BR value, never empty/raw-key/crash)
 *  - P1-AC8: localStorage unavailable → in-memory language honored, no throw
 *  - Edge cases: navigator.language absent/unknown → pt-BR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the pure utility and the configured instance separately
// so tests can verify both behavior and config.
import { convertDetectedLanguage, LANG_STORAGE_KEY } from '../index';
import i18n from '../index';

describe('convertDetectedLanguage — locale normalisation', () => {
  it('maps "pt" to "pt-BR"', () => {
    expect(convertDetectedLanguage('pt')).toBe('pt-BR');
  });

  it('maps "pt-PT" to "pt-BR"', () => {
    expect(convertDetectedLanguage('pt-PT')).toBe('pt-BR');
  });

  it('maps "pt-BR" to "pt-BR"', () => {
    expect(convertDetectedLanguage('pt-BR')).toBe('pt-BR');
  });

  it('maps "en" to "en-US"', () => {
    expect(convertDetectedLanguage('en')).toBe('en-US');
  });

  it('maps "en-GB" to "en-US"', () => {
    expect(convertDetectedLanguage('en-GB')).toBe('en-US');
  });

  it('maps "en-US" to "en-US"', () => {
    expect(convertDetectedLanguage('en-US')).toBe('en-US');
  });

  it('maps "fr-FR" (unsupported) to "pt-BR"', () => {
    expect(convertDetectedLanguage('fr-FR')).toBe('pt-BR');
  });

  it('maps empty string to "pt-BR"', () => {
    expect(convertDetectedLanguage('')).toBe('pt-BR');
  });
});

describe('i18n bootstrap — configuration', () => {
  it('is configured with fallbackLng "pt-BR"', () => {
    const fallback = i18n.options.fallbackLng;
    // i18next stores fallbackLng as a string or string[]
    const normalized = Array.isArray(fallback) ? fallback[0] : fallback;
    expect(normalized).toBe('pt-BR');
  });

  it('is configured with supportedLngs including "pt-BR" and "en-US"', () => {
    const supported = i18n.options.supportedLngs as string[];
    expect(supported).toContain('pt-BR');
    expect(supported).toContain('en-US');
  });

  it('uses "rathe.lang" as the localStorage key', () => {
    expect(LANG_STORAGE_KEY).toBe('rathe.lang');
  });
});

describe('languageChanged → document.documentElement.lang', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
  });

  it('sets document.documentElement.lang when language changes to pt-BR', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('sets document.documentElement.lang when language changes to en-US', async () => {
    await i18n.changeLanguage('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });
});

describe('missing-key fallback resolves to the pt-BR value at runtime (P1-AC7)', () => {
  // The config test above proves fallbackLng is 'pt-BR'. This proves the
  // runtime OUTCOME the spec defines: a key absent from the active locale
  // serves the pt-BR value — never empty, never the raw key, never a crash.
  // The catalog-parity gate prevents real key drift; this covers the path
  // i18next takes if a key is ever missing at runtime.
  const PT_ONLY_KEY = '__test.ptOnlyFallbackKey';

  it('serves the pt-BR value for a key present only in pt-BR while en-US is active', async () => {
    // Arrange: a key that exists ONLY in pt-BR, simulating a gap in en-US.
    i18n.addResource('pt-BR', 'translation', PT_ONLY_KEY, 'valor em português');
    await i18n.changeLanguage('en-US');

    // Act
    const result = i18n.t(PT_ONLY_KEY);

    // Assert: the pt-BR value is served, not an empty string or the raw key.
    expect(result).toBe('valor em português');
  });

  it('returns a non-empty string (no crash, no blank) for a key absent from every locale', async () => {
    await i18n.changeLanguage('en-US');
    const result = i18n.t('__test.completelyUnknownKey');
    expect(typeof result).toBe('string');
    expect(result).not.toBe('');
  });
});

describe('localStorage unavailable → in-memory language honored without throwing (P1-AC8)', () => {
  // Spec P1-AC8: in private browsing where storage writes throw, switching
  // language must still apply in-memory and must NOT throw (mirrors the
  // ThemeToggle pattern). The browser-language-detector owns the cache write;
  // this proves the integration tolerates a throwing localStorage.setItem.
  it('applies the locale and does not throw when localStorage.setItem throws', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage unavailable (private browsing)');
    });

    try {
      await expect(i18n.changeLanguage('en-US')).resolves.toBeDefined();
      expect(i18n.language).toBe('en-US');
    } finally {
      setItemSpy.mockRestore();
      await i18n.changeLanguage('pt-BR');
    }
  });
});
