import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '../../i18n';
import { setTestLocale } from '../../test/i18n-test-utils';
import { DeckList } from '../../components/deck-detail/DeckList';
import { LibraryGrid } from '../../components/library/LibraryGrid';
import { SharedDeckGallery } from '../../components/shared-deck/SharedDeckGallery';
import type { IDeckListItem } from '../../components/deck-detail/deckListModel';
import type { ISharedCard } from '../../api/shared-decks';
import type { ILibraryCard } from '../../api/library';
import { cardGroupOf, CARD_GROUP_LABEL_KEY, groupCardsByKind, type ICardGroupFacts } from '../card-groups';

vi.mock('../../components/card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => React.createElement('div', { 'data-testid': 'card-art', 'aria-label': name }),
}));
vi.mock('../../components/library/LibraryCardStepper', () => ({ LibraryCardStepper: () => null }));
vi.mock('../../api/collection', () => ({
  useAddCardMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDecrementCardMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

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

  it('one grouping rule for every card list: the deck page, the Library and the shared deck page render the same headings', async () => {
    await setTestLocale('pt-BR');
    const KINDS = [
      ['action', 'Action', 'mainboard'],
      ['attack-reaction', 'Attack Reaction', 'mainboard'],
      ['defense-reaction', 'Defense Reaction', 'mainboard'],
      ['instant', 'Instant', 'mainboard'],
      ['hero', 'Hero', 'hero'],
      ['weapon', 'Weapon', 'weapon'],
      ['equipment', 'Equipment', 'equipment'],
    ] as const;
    // One deck, listed backwards so the order of the headings can only come from the grouping rule.
    const reversed = [...KINDS].reverse();
    const deckPage = reversed.map(([id, type, slot]): IDeckListItem => ({
      key: `${id}::${slot}`,
      entry: { cardIdentifier: id, name: `Card ${id}`, quantity: 2, slot, pitch: 1, cost: 1, type, imageUrl: null },
      quantity: 2,
      missing: 0,
    }));
    const library = reversed.map(([id, type]): ILibraryCard => ({
      cardIdentifier: id,
      name: `Card ${id}`,
      pitch: 1,
      types: [type],
      subtypes: [],
      classes: [],
      talents: [],
      sets: ['WTR'],
      imageUrl: null,
      ownedQuantity: 1,
      contributions: [],
    }));
    const shared = reversed.map(([id, type, slot]): ISharedCard => ({
      cardIdentifier: id,
      name: `Card ${id}`,
      pitch: 1,
      type,
      slot,
      quantity: 2,
      imageUrl: null,
    }));
    const headingsOf = (level: 2 | 3, scope: HTMLElement): string[] =>
      within(scope)
        .getAllByRole('heading', { level })
        .map((heading) => heading.firstChild?.textContent ?? '');

    const deckView = render(React.createElement(DeckList, { items: deckPage }));
    const onDeckPage = headingsOf(3, screen.getByTestId('deck-list'));
    deckView.unmount();
    const libraryView = render(React.createElement(LibraryGrid, { cards: library, group: 'type' }));
    const inLibrary = headingsOf(2, libraryView.container);
    libraryView.unmount();
    const sharedView = render(React.createElement(SharedDeckGallery, { cards: shared }));
    const onSharedPage = headingsOf(2, sharedView.container);

    const expected = groupCardsByKind(DECK, (card) => card)
      .filter((group) => group.id !== 'other')
      .map((group) => i18n.t(CARD_GROUP_LABEL_KEY[group.id]));
    expect(expected).toEqual(['Ações', 'Reações de ataque', 'Reações de defesa', 'Instantâneos', 'Herói', 'Arma', 'Equipamentos']);
    expect(onDeckPage).toEqual(expected);
    expect(inLibrary).toEqual(expected);
    expect(onSharedPage).toEqual(expected);
    for (const heading of [...onDeckPage, ...inLibrary, ...onSharedPage]) {
      expect(heading).not.toMatch(/Attack Actions|Defense Reactions|Non-attack Actions|Hero · Weapon · Equipment/i);
      expect(heading).not.toBe(heading.toUpperCase());
    }
  });
});
