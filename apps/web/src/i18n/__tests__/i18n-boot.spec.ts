/**
 * T4 smoke test — i18n wired into app boot
 *
 * main.tsx is excluded from coverage, so this test verifies the observable
 * effect: after the global beforeEach (which fires languageChanged), the
 * document.documentElement.lang attribute is 'pt-BR' — matching the spec AC:
 * "App boots with i18n active; default <html lang> is pt-BR".
 *
 * Spec AC: I18N-01 (i18n infra), I18N-04 (<html lang> reflects active language)
 */

import { describe, it, expect } from 'vitest';
import i18n from '../index';

describe('i18n boot — default html lang', () => {
  it('document.documentElement.lang is pt-BR after i18n init at default locale', () => {
    // The global beforeEach in setup.ts calls i18n.changeLanguage('pt-BR'),
    // which fires the languageChanged listener registered in i18n/index.ts.
    // That listener sets document.documentElement.lang = 'pt-BR'.
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('i18n instance reports pt-BR as the active language after boot', () => {
    expect(i18n.language).toBe('pt-BR');
  });
});
