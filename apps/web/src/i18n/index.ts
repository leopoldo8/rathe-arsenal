/**
 * i18n bootstrap — i18next instance with browser-language detection.
 *
 * Detection order: localStorage → navigator (browser locale).
 * Cache: localStorage only (per owner decision — no locale in user profile).
 * Fallback: pt-BR (product default).
 *
 * Storage key mirrors the convention in apps/web/src/styles/theme-init.ts
 * (rathe-arsenal: prefix). Using 'rathe.lang' as specified in the design.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { ptBR } from './locales/pt-BR';
import { enUS } from './locales/en-US';

/** localStorage key for the persisted language preference. */
export const LANG_STORAGE_KEY = 'rathe.lang';

/**
 * Normalize any detected locale to exactly 'pt-BR' or 'en-US'.
 *
 * - Anything starting with 'pt' → 'pt-BR'
 * - Anything starting with 'en' → 'en-US'
 * - Everything else (absent, unknown, unsupported) → 'pt-BR' (fallback)
 *
 * Exported for direct unit testing.
 */
export function convertDetectedLanguage(lng: string): 'pt-BR' | 'en-US' {
  if (lng.startsWith('pt')) return 'pt-BR';
  if (lng.startsWith('en')) return 'en-US';
  return 'pt-BR';
}

// Register the languageChanged listener before init so it fires on the
// initial language detection during init (spec AC P1-AC6: html lang mirrors
// the active language at all times).
i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Resources keyed by locale; cast needed because our `as const` stubs
    // produce narrow literal types not assignable to the ResourceLanguage index.
    resources: {
      'pt-BR': ptBR as Record<string, Record<string, unknown>>,
      'en-US': enUS as Record<string, Record<string, unknown>>,
    },
    supportedLngs: ['pt-BR', 'en-US'],
    fallbackLng: 'pt-BR',
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      // Normalize detected locale to our two supported tags.
      convertDetectedLanguage,
    },
    interpolation: {
      escapeValue: false,
    },
  });

// Belt-and-suspenders: set the initial lang attr in case the languageChanged
// event already fired before the listener was registered (timing edge).
if (typeof document !== 'undefined' && i18n.language) {
  document.documentElement.lang = i18n.language;
}

export default i18n;
