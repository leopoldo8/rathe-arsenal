import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';
import { enUS } from '../locales/en-US';

/**
 * Recursively collect every leaf key path (e.g. `settings.languageHeading`)
 * from a translation catalog. Nested namespace objects recurse; string leaves
 * terminate.
 */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? collectKeyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n catalog parity', () => {
  // Guards spec I18N-06: a key present in one locale but missing/extra in the
  // other would let a string fall back silently or leak. The structural type
  // catches missing keys at compile time; this catches EXTRA keys too (which
  // excess-property checks miss on imported consts) and proves runtime parity.
  it('pt-BR and en-US expose an identical set of translation key paths', () => {
    const pt = collectKeyPaths(ptBR as Record<string, unknown>).sort();
    const en = collectKeyPaths(enUS as Record<string, unknown>).sort();
    expect(en).toEqual(pt);
  });
});
