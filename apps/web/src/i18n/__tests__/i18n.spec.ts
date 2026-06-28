/**
 * T2: i18next bootstrap unit tests
 *
 * Spec ACs covered:
 *  - P1-AC1/AC2: language detection + PT-BR/EN-US resolution
 *  - P1-AC6: languageChanged → document.documentElement.lang
 *  - P1-AC7: fallbackLng: 'pt-BR' (missing-key fallback)
 *  - Edge cases: navigator.language absent/unknown → pt-BR
 */

import { describe, it, expect, beforeEach } from 'vitest';

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
