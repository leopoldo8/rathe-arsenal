import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { setTestLocale } from '../../test/i18n-test-utils';
import { cardGroupOf, CARD_GROUP_LABEL_KEY, groupCardsByKind, type ICardGroupFacts } from '../card-groups';

interface IFixtureCard extends ICardGroupFacts {
  readonly name: string;
}

const DECK: readonly IFixtureCard[] = [
  { name: 'Wild Ride', type: 'Action', slot: 'mainboard' },
  { name: 'Sigil of Solace', type: 'Action', slot: 'mainboard' },
  { name: 'Razor Reflex', type: 'Attack Reaction', slot: 'mainboard' },
  { name: 'Sink Below', type: 'Defense Reaction', slot: 'mainboard' },
  { name: 'Flick Knives', type: 'Instant', slot: 'mainboard' },
  { name: 'Rhinar', type: 'Hero', slot: 'hero' },
  { name: 'Romping Club', type: 'Weapon', slot: 'weapon' },
  { name: 'Skullbone Crux', type: 'Equipment', slot: 'equipment' },
  { name: 'Agility', type: 'Token', slot: 'mainboard' },
];

describe('card groups', () => {
  it('one grouping rule for every card list', async () => {
    await setTestLocale('pt-BR');

    const groups = groupCardsByKind([...DECK].reverse(), (card) => card);

    expect(groups.map((group) => group.id)).toEqual([
      'action',
      'attackReaction',
      'defenseReaction',
      'instant',
      'hero',
      'weapon',
      'equipment',
      'other',
    ]);
    expect(groups.map((group) => i18n.t(CARD_GROUP_LABEL_KEY[group.id]))).toEqual([
      'Ações',
      'Reações de ataque',
      'Reações de defesa',
      'Instantâneos',
      'Herói',
      'Arma',
      'Equipamentos',
      'Outras cartas',
    ]);
  });

  it('one grouping rule for every card list: the same ordered headings for the same cards', () => {
    const first = groupCardsByKind(DECK, (card) => card).map((group) => group.id);
    const second = groupCardsByKind([...DECK].reverse(), (card) => card).map((group) => group.id);

    expect(second).toEqual(first);
  });

  it('one grouping rule for every card list: no heading is English or a raw catalog type', async () => {
    await setTestLocale('pt-BR');

    const headings = groupCardsByKind(DECK, (card) => card).map((group) => i18n.t(CARD_GROUP_LABEL_KEY[group.id]));

    for (const heading of headings) {
      expect(heading).not.toMatch(/Attack Actions|Defense Reactions|Non-attack Actions|Hero · Weapon · Equipment/i);
      expect(heading).not.toBe(heading.toUpperCase());
    }
  });

  it('puts a card in its slot group before its type', () => {
    expect(cardGroupOf({ slot: 'weapon', type: 'Action' })).toBe('weapon');
    expect(cardGroupOf({ type: 'Weapon' })).toBe('weapon');
  });

  it('skips groups with no card and keeps the input order inside a group', () => {
    const groups = groupCardsByKind(
      [
        { name: 'B', type: 'Defense Reaction' },
        { name: 'A', type: 'Defense Reaction' },
      ],
      (card) => card,
    );

    expect(groups.map((group) => group.id)).toEqual(['defenseReaction']);
    expect(groups[0]?.cards.map((card) => card.name)).toEqual(['B', 'A']);
  });
});
