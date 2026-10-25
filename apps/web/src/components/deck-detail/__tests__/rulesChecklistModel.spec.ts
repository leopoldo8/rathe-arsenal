import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n';
import { buildRulesChecklist } from '../rulesChecklistModel';
import { computeDraftLegality } from '../../../lib/draft-legality';
import { blitzDraft, draftCard, RHINAR, verdictOf } from './rulesChecklistTestData';
import type { ICompositionDraft } from '../../../hooks/useCompositionDraft';

const t = i18n.t.bind(i18n);

function build(draft: ICompositionDraft, hero = RHINAR) {
  const result = computeDraftLegality(draft, hero);
  if (result === null) throw new Error('hero fixture must resolve');
  return buildRulesChecklist({ result, draft, heroName: hero.name, t });
}

describe('buildRulesChecklist', () => {
  it('has no checklist for a format with no rules', () => {
    const draft = { ...blitzDraft({ deckCards: 40, packHuntCopies: 1 }), format: 'Draft' };

    expect(build(draft)).toBeNull();
  });

  it('says only what to add when the size is the one thing left', () => {
    const checklist = build(blitzDraft({ deckCards: 31, packHuntCopies: 1 }));

    expect(checklist?.problemCount).toBe(0);
    expect(checklist?.closeSteps).toBe('Para fechar: coloque mais 9 cartas.');
  });

  it('says nothing to close when the deck is complete', () => {
    const checklist = build(blitzDraft({ deckCards: 40, packHuntCopies: 1 }));

    expect(checklist?.closeSteps).toBeNull();
    expect(checklist?.lines.at(-1)).toMatchObject({ tone: 'neutral', text: 'Tamanho: 40 de 40 cartas' });
  });

  it('does the arithmetic of each step: taking a copy out shortens the deck', () => {
    const checklist = build(blitzDraft({ deckCards: 40, packHuntCopies: 2 }));

    expect(checklist?.closeSteps).toBe('Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 39, então coloque mais 1 carta.');
  });

  it('names a Legendary card by its own limit', () => {
    const draft = blitzDraft({ deckCards: 31, packHuntCopies: 1 });
    const legendary = draftCard({ cardIdentifier: 'amulet', name: 'Amethyst Amulet', pitch: 3, legendary: true, quantity: 2 });

    const checklist = build({ ...draft, cards: [...draft.cards, legendary] });

    expect(checklist?.lines.map((line) => line.text)).toContain('Cópias: Amethyst Amulet (Azul) tem 2, uma carta lendária só pode ter 1');
  });

  it('points a card the format refuses to its row and asks to take it out', () => {
    const draft = blitzDraft({ deckCards: 31, packHuntCopies: 1 });
    const banned = draftCard({ cardIdentifier: 'banned-card', name: 'Banned Card', pitch: 1, bannedFormats: ['Blitz'] });

    const checklist = build({ ...draft, cards: [...draft.cards, banned] });

    const line = checklist?.lines.find((entry) => entry.cardIdentifier === 'banned-card');
    expect(line).toMatchObject({ tone: 'problem', text: 'Banned Card (Vermelho) está banida em Blitz.' });
    expect(checklist?.closeSteps).toContain('tire Banned Card (Vermelho)');
  });

  it('asks to change the hero or the format when the hero is outside the format', () => {
    const draft = blitzDraft({ deckCards: 40, packHuntCopies: 1 });
    const adult = { ...RHINAR, young: false, legalFormats: ['Classic Constructed'] };

    const checklist = build(draft, adult);

    expect(checklist?.lines[0]).toMatchObject({ tone: 'problem' });
    expect(checklist?.closeSteps).toBe('Para fechar: troque o herói ou o formato.');
  });

  it('counts the size in a format with a minimum, not an exact deck', () => {
    const result = verdictOf(blitzDraft({ deckCards: 40, packHuntCopies: 1 }));
    expect(result.category).toBe('legal');

    const classic = { ...blitzDraft({ deckCards: 62, packHuntCopies: 1 }), format: 'Classic Constructed' };
    const checklist = build(classic, { ...RHINAR, young: false, legalFormats: ['Classic Constructed'] });

    expect(checklist?.barText).toBe('62 cartas · nenhum problema');
    expect(checklist?.lines.at(-1)?.text).toBe('Tamanho: 62 cartas (o mínimo é 60)');
  });
});
