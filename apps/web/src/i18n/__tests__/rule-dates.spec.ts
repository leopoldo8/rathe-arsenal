import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';

const LITERAL_DATE =
  /\b\d{1,2} de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}\b/;

function collectValues(node: unknown, path: string): readonly { readonly path: string; readonly value: string }[] {
  if (typeof node === 'string') return [{ path, value: node }];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) => collectValues(child, `${path}.${key}`));
}

describe('rule dates', () => {
  it('no locale value prints a literal date', () => {
    const offenders = collectValues(ptBR, 'ptBR').filter(({ value }) => LITERAL_DATE.test(value));

    expect(offenders).toEqual([]);
  });
});
