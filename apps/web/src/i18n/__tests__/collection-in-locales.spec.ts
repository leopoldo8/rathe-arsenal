import { describe, expect, it } from 'vitest';
import i18n from '../index';
import { enUS } from '../locales/en-US';
import { ptBR } from '../locales/pt-BR';
import { setTestLocale } from '../../test/i18n-test-utils';

function collectValues(node: unknown): readonly string[] {
  if (typeof node === 'string') return [node];
  if (node === null || typeof node !== 'object') return [];
  return Object.values(node as Record<string, unknown>).flatMap(collectValues);
}

describe('collection-in locales', () => {
  it('the manual source has one name in every locale', () => {
    expect(ptBR.csvSources.manualSourceLabel).toBe('Entradas à mão');
    expect(enUS.csvSources.manualSourceLabel).toBe('Hand entries');

    for (const [name, catalog] of [['pt-BR', ptBR], ['en-US', enUS]] as const) {
      const offenders = collectValues(catalog).filter((value) => /manual entries|entradas manuais/i.test(value));
      expect(offenders, `${name} still names the manual source another way`).toEqual([]);
    }
  });

  it.each([
    ['pt-BR', 'library.bannerImported', ['0 cartas importadas', '1 carta importada', '2 cartas importadas']],
    ['pt-BR', 'collectionReader.copiesCount', ['0 cópias', '1 cópia', '2 cópias']],
    ['pt-BR', 'copyVersions.copiesCount', ['0 cópias', '1 cópia', '2 cópias']],
    ['pt-BR', 'collectionReader.linesToResolve', ['0 linhas para resolver', '1 linha para resolver', '2 linhas para resolver']],
    ['en-US', 'library.bannerImported', ['0 cards imported', '1 card imported', '2 cards imported']],
    ['en-US', 'collectionReader.copiesCount', ['0 copies', '1 copy', '2 copies']],
    ['en-US', 'copyVersions.copiesCount', ['0 copies', '1 copy', '2 copies']],
    ['en-US', 'collectionReader.linesToResolve', ['0 lines to resolve', '1 line to resolve', '2 lines to resolve']],
  ] as const)('collection counts use plural forms: %s %s', async (locale, key, expected) => {
    await setTestLocale(locale);

    const written = [0, 1, 2].map((count) => i18n.t(key, { count }));

    expect(written).toEqual(expected);
  });
});
