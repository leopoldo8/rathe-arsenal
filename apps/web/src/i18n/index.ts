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

// Persisted-language cache that never throws on write. i18next's built-in
// localStorage detector calls `localStorage.setItem` UNGUARDED, so a failing
// write (private browsing / quota exceeded) propagates synchronously out of
// `changeLanguage` and would throw on a language switch. We route the cache
// write through a guarded detector that swallows storage errors — the language
// still applies in-memory and the switch never throws (spec P1-AC8; mirrors the
// ThemeToggle try/catch around localStorage). Reads stay on the built-in
// 'localStorage' detector, whose lookup path is already guarded.
const languageDetector = new LanguageDetector();
languageDetector.addDetector({
  name: 'safeLocalStorage',
  // Cache-only detector (see detection.caches); never in the lookup order, so
  // lookup is a no-op and the built-in 'localStorage' detector handles reads.
  lookup: () => undefined,
  cacheUserLanguage: (lng: string): void => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lng);
    } catch {
      // Storage unavailable — honor the in-memory language, never throw.
    }
  },
});

void i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    // Each catalog is nested under the default `translation` namespace so our
    // hierarchical keys resolve with the default `.` keySeparator — e.g.
    // `t('settings.languageHeading')`. Keying the locale directly to the
    // catalog would instead make `common`/`settings`/... i18next NAMESPACES,
    // breaking dotted lookups. Cast because our `as const` catalogs produce
    // narrow literal types not assignable to the ResourceLanguage index.
    resources: {
      'pt-BR': { translation: ptBR as Record<string, unknown> },
      'en-US': { translation: enUS as Record<string, unknown> },
    },
    supportedLngs: ['pt-BR', 'en-US'],
    fallbackLng: 'pt-BR',
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      // Writes go through the guarded cache; reads use the built-in detector.
      caches: ['safeLocalStorage'],
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
