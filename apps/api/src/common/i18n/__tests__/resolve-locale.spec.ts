import { resolveLocale } from '../resolve-locale';

describe('resolveLocale', () => {
  // Done-when: pt-BR → 'pt-BR'
  it('returns pt-BR for the exact pt-BR tag', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
  });

  // Done-when: pt → 'pt-BR'
  it('returns pt-BR for a bare pt tag', () => {
    expect(resolveLocale('pt')).toBe('pt-BR');
  });

  // Done-when: en-US,en;q=0.9,pt;q=0.8 → 'en-US'
  it('returns en-US when en-US is the highest quality supported locale', () => {
    expect(resolveLocale('en-US,en;q=0.9,pt;q=0.8')).toBe('en-US');
  });

  // Done-when: pt-BR;q=1,en;q=0.5 → 'pt-BR'
  it('returns pt-BR when pt-BR has highest quality in a list', () => {
    expect(resolveLocale('pt-BR;q=1,en;q=0.5')).toBe('pt-BR');
  });

  // Done-when: '' → 'pt-BR'
  it('returns pt-BR for an empty string header', () => {
    expect(resolveLocale('')).toBe('pt-BR');
  });

  // Done-when: undefined → 'pt-BR'
  it('returns pt-BR for an undefined header', () => {
    expect(resolveLocale(undefined)).toBe('pt-BR');
  });

  // Done-when: fr-FR → 'pt-BR' (unsupported locale)
  it('returns pt-BR for an unsupported locale fr-FR', () => {
    expect(resolveLocale('fr-FR')).toBe('pt-BR');
  });

  // Edge case: en (bare) → 'en-US'
  it('returns en-US for a bare en tag', () => {
    expect(resolveLocale('en')).toBe('en-US');
  });

  // Edge case: quality list where only fallback locale survives
  it('returns en-US when en-US appears after an unsupported locale at lower quality', () => {
    expect(resolveLocale('fr;q=0.9,en-US;q=0.8')).toBe('en-US');
  });
});
