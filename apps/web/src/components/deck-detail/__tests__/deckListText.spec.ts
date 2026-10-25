import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n';
import { buildFabraryText, buildGroupText, buildRuleWarning } from '../deckListText';
import {
  FIXTURE_CARDS,
  FIXTURE_DECK_NAME,
  FIXTURE_FORMAT,
  FIXTURE_ILLEGAL_LEGALITY,
  FIXTURE_LEGAL_LEGALITY,
} from './copyListFixture';

const input = { deckName: FIXTURE_DECK_NAME, format: FIXTURE_FORMAT, cards: FIXTURE_CARDS };

const DECK_LINES = [
  '3x Pack Hunt (Vermelho)',
  '3x Awakening Bellow (Azul)',
  '3x Barraging Beatdown (Vermelho)',
  '3x Barraging Brawnhide (Amarelo)',
  '3x Breakneck Battery (Azul)',
  '3x Demolition Crew (Vermelho)',
  '3x Energy Potion (Azul)',
  '3x Flock of the Feather Walkers (Azul)',
  '3x Nimble Strike (Vermelho)',
  '3x Nimblism (Amarelo)',
  '3x Potion of Strength (Azul)',
  '3x Primeval Bellow (Vermelho)',
  '3x Raging Onslaught (Amarelo)',
  '3x Razor Reflex (Azul)',
  '3x Regurgitating Slog (Vermelho)',
  '3x Savage Feast (Amarelo)',
  '3x Savage Swing (Azul)',
  '3x Scar for a Scar (Vermelho)',
  '3x Scour the Battlescape (Vermelho)',
  '3x Springboard Somersault (Amarelo)',
];

const INVENTORY_LINES = [
  '1x Pack Hunt (Vermelho)',
  '2x Bone Head Barrier (Amarelo)',
  '2x Muscle Mutt (Amarelo)',
  '3x Pummel (Azul)',
  '2x Reckless Swing (Azul)',
  '3x Sink Below (Vermelho)',
  '2x Snatch (Vermelho)',
];

describe('the group text', () => {
  it('the group text matches r3-export-group-desktop', () => {
    const expected = [
      'Rhinar CC · Classic Constructed',
      '',
      'Herói',
      '1x Rhinar, Reckless Rampage',
      '',
      'Arma',
      '1x Romping Club',
      '',
      'Equipamentos',
      '1x Scabskin Leathers',
      "1x Fyendal's Spring Tunic",
      '1x Nullrune Hood',
      '1x Arcanite Skullcap',
      '',
      'Deck (60 cartas)',
      ...DECK_LINES,
      '',
      'Inventário (15 cartas, fora do deck)',
      ...INVENTORY_LINES,
    ].join('\n');

    expect(buildGroupText(input, i18n.t.bind(i18n))).toBe(expected);
  });

  it('leaves a section out when it has no card and says one card in the singular', () => {
    const onlyHero = FIXTURE_CARDS.filter((card) => card.slot === 'hero');
    const oneCard = [{ ...FIXTURE_CARDS.find((card) => card.slot === 'mainboard')!, quantity: 1, inventoryQuantity: 0 }];

    const text = buildGroupText({ ...input, cards: [...onlyHero, ...oneCard] }, i18n.t.bind(i18n));

    expect(text).toBe(
      ['Rhinar CC · Classic Constructed', '', 'Herói', '1x Rhinar, Reckless Rampage', '', 'Deck (1 carta)', '1x Pack Hunt (Vermelho)'].join('\n'),
    );
  });
});

describe('the fabrary text', () => {
  it('the fabrary text has one english line per card', () => {
    const lines = buildFabraryText(input).split('\n').filter((line) => line !== '');

    const headings = lines.filter((line) => !/^\d+x /.test(line));
    expect(headings).toEqual(['Hero', 'Weapon', 'Equipment', 'Deck', 'Inventory']);
    expect(lines).toContain('3x Pack Hunt (Red)');
    expect(lines).toContain('3x Awakening Bellow (Blue)');
    expect(lines).toContain('3x Barraging Brawnhide (Yellow)');
    expect(lines).toContain('1x Romping Club');
    expect(lines).toContain('1x Rhinar, Reckless Rampage');
    expect(lines.filter((line) => /^\d+x /.test(line))).toHaveLength(1 + 1 + 4 + 20 + 7);
    expect(lines.indexOf('Hero')).toBeLessThan(lines.indexOf('Weapon'));
    expect(lines.indexOf('Weapon')).toBeLessThan(lines.indexOf('Equipment'));
    expect(lines.indexOf('Equipment')).toBeLessThan(lines.indexOf('Deck'));
    expect(lines.indexOf('Deck')).toBeLessThan(lines.indexOf('Inventory'));
    expect(lines[lines.indexOf('Inventory') + 1]).toBe('1x Pack Hunt (Red)');
    expect(buildFabraryText(input)).not.toMatch(/Vermelho|Azul|Amarelo|Herói|GEM/);
  });
});

describe('the rule warning', () => {
  it('names the card over the limit with its deck and inventory split', () => {
    expect(buildRuleWarning(FIXTURE_ILLEGAL_LEGALITY, FIXTURE_CARDS, FIXTURE_FORMAT, i18n.t.bind(i18n))).toBe(
      'Esta lista não vale no Classic Constructed: Pack Hunt (Vermelho) aparece 4 vezes (3 no deck, 1 no inventário), o limite é 3. Dá para copiar mesmo assim.',
    );
  });

  it('says nothing for a legal deck', () => {
    expect(buildRuleWarning(FIXTURE_LEGAL_LEGALITY, FIXTURE_CARDS, FIXTURE_FORMAT, i18n.t.bind(i18n))).toBeNull();
    expect(buildRuleWarning(null, FIXTURE_CARDS, FIXTURE_FORMAT, i18n.t.bind(i18n))).toBeNull();
  });
});
