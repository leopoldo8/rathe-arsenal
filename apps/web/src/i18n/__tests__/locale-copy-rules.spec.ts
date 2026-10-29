import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';
import i18n from '../index';
import { setTestLocale } from '../../test/i18n-test-utils';
import { findCopyViolations, GENDERED_WORDS, scanCatalog } from '../locale-copy-rules';

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

  it('leaves the account namespace unscanned so its Trocar link stays (D55)', () => {
    expect(findCopyViolations('account', 'Não é você? Trocar')).toEqual([]);
    expect(ptBR.account.notYou).toBe('Não é você? Trocar');
    expect(scanCatalog(ptBR).filter((v) => v.path === 'account.notYou')).toEqual([]);
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

  it('outside a deck the app says substituir', () => {
    expect(ptBR.home.emptyLead).toContain('quais cartas da sua coleção podem substituir as que faltam');

    const rewritten = [
      ptBR.home.emptyLead,
      ptBR.home.step2Body,
      ptBR.auth.decorationCopy,
      ptBR.onboarding.step2BodySingle,
      ptBR.onboarding.step2BodyMultiple,
      ptBR.onboarding.congratsBody,
    ];
    for (const value of rewritten) {
      expect(value).not.toMatch(/\btrocas?\b|\btrocar\b/i);
    }
  });

  it('zero free copies read nenhuma livre', async () => {
    await setTestLocale('pt-BR');

    expect(i18n.t('alternatives.free', { count: 0 })).toBe('nenhuma livre');
    expect(i18n.t('alternatives.free', { count: 1 })).toBe('1 livre');
    expect(i18n.t('alternatives.free', { count: 2 })).toBe('2 livres');
  });

  it('no value gives the player a gender', () => {
    expect(GENDERED_WORDS).toEqual(['bem-vindo', 'bem-vinda', 'conectado', 'conectada', 'logado', 'logada']);
    expect(findCopyViolations('home', 'Você está conectada')).toEqual([expect.objectContaining({ rule: 'gendered-word' })]);
    expect(findCopyViolations('home', 'Bem-vindo de volta')).toEqual([expect.objectContaining({ rule: 'gendered-word' })]);
    expect(findCopyViolations('home', 'A conta fica aberta neste celular')).toEqual([]);
    expect(
      scanCatalog(ptBR)
        .filter((violation) => violation.rule === 'gendered-word')
        .map((violation) => violation.path),
    ).toEqual([]);
  });
});
