import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';
import { findCopyViolations, scanCatalog } from '../locale-copy-rules';

describe('locale copy rules', () => {
  it('flags an em dash and an en dash in a value', () => {
    expect(findCopyViolations('common', 'x — y')).toEqual([expect.objectContaining({ rule: 'dash' })]);
    expect(findCopyViolations('common', 'x – y')).toEqual([expect.objectContaining({ rule: 'dash' })]);
    expect(findCopyViolations('common', 'x - y')).toEqual([]);
  });

  it('flags troca outside a deck and the leaked English literals', () => {
    for (const word of ['troca', 'trocas', 'trocar', 'Troca', 'TROCAR']) {
      for (const namespace of ['home', 'auth', 'onboarding']) {
        expect(findCopyViolations(namespace, `Veja a ${word} agora`)).toEqual([
          expect.objectContaining({ rule: 'banned-word' }),
        ]);
      }
      expect(findCopyViolations('deckDetail', `Veja a ${word} agora`)).toEqual([]);
      expect(findCopyViolations('alternatives', `Veja a ${word} agora`)).toEqual([]);
    }
    expect(findCopyViolations('home', 'trocado')).toEqual([]);
    expect(findCopyViolations('deckDetail', 'Manual entries')).toEqual([
      expect.objectContaining({ rule: 'english-literal' }),
    ]);
    expect(findCopyViolations('library', 'Attack Actions')).toEqual([
      expect.objectContaining({ rule: 'english-literal' }),
    ]);
  });

  it('no pt-BR value contains an em or en dash', () => {
    const offenders = scanCatalog(ptBR)
      .filter((v) => v.rule === 'dash')
      .map((v) => v.path);
    expect(offenders).toEqual([]);
  });

  it('the pt-BR catalog passes every copy rule', () => {
    expect(scanCatalog(ptBR).map((v) => `${v.path} (${v.rule})`)).toEqual([]);
  });
});
