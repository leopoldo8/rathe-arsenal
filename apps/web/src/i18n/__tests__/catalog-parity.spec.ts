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

function valuesOf(namespace: Record<string, unknown>): string[] {
  return Object.values(namespace).flatMap((value) =>
    value !== null && typeof value === 'object' ? valuesOf(value as Record<string, unknown>) : [String(value)],
  );
}

const PROMISES_A_REMOVAL = /ser(á|ão) removid|vamos tirar|tiraremos/i;

describe('deck copy', () => {
  it('no deck copy promises a removal', () => {
    const copy = [...valuesOf(ptBR.deckDetail), ...valuesOf(ptBR.deckEdit)];

    expect(copy.filter((value) => PROMISES_A_REMOVAL.test(value))).toEqual([]);
  });

  it('no deck copy of the decks namespace says saving removes a card', () => {
    const removes = valuesOf(ptBR.decks).filter((value) => /(ao salvar|ao salvar,).*(removid|removida)|é removida|são removidas/i.test(value));

    expect(removes).toEqual([]);
  });

  it('replacements are as substituições', () => {
    const copy = valuesOf(ptBR.deckDetail);

    expect(copy.filter((value) => /trocas? de cartas/i.test(value))).toEqual([]);
  });
});

describe('inventory copy', () => {
  it('the inventory line is the one of copy rule 6', () => {
    const copy = valuesOf(ptBR as Record<string, unknown>);

    expect(copy.filter((value) => /jogo 1/i.test(value))).toEqual([]);
    expect(ptBR.deckDetail.inventoryPlain).toBe(
      'Inventário: cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas.',
    );
  });
});
