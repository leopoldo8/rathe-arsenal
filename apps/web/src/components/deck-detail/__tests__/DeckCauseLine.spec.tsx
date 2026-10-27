import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckCauseLine } from '../DeckCauseLine';
import { DeckStageBlock } from '../../home/DeckStageBlock';
import type { IDeckLegality, ITrackedDeckListItem } from '../../../api/decks';

const NO_WORDS: ReadonlyArray<[string, IDeckLegality['details']]> = [
  ['a card pool problem', [{ code: 'card_pool_too_large', params: { card: null, count: 81, limit: 80, format: 'Classic Constructed' } }]],
  ['a card the hero cannot use', [{ code: 'card_not_for_hero', params: { card: 'a', cardIdentifier: 'a', hero: 'Rhinar' } }]],
  ['an unknown card', [{ code: 'card_unknown', params: { card: 'a', cardIdentifier: 'a' } }]],
];

function illegal(details: IDeckLegality['details']): IDeckLegality {
  return { category: 'illegal', reasons: ['x'], details } as IDeckLegality;
}

describe('the cause line of a deck with a rule problem', () => {
  it.each(NO_WORDS)('the deck page prints no empty line for %s', (_label, details) => {
    const { container } = render(<DeckCauseLine legality={illegal(details)} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(NO_WORDS)('the home card keeps its red chip and prints no empty line for %s', (_label, details) => {
    const deck = {
      id: 1,
      name: 'Rhinar CC',
      format: 'Classic Constructed',
      status: 'ready',
      deckSize: 60,
      legality: illegal(details),
    } as unknown as ITrackedDeckListItem;

    render(<DeckStageBlock deck={deck} />);

    expect(screen.getByTestId('legality-illegal')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-cause')).not.toBeInTheDocument();
    expect(screen.getByTestId('deck-stage-line')).toBeInTheDocument();
  });

  it('prints the line when a named problem is present', () => {
    const copies = {
      code: 'too_many_copies',
      params: { card: 'a', cardIdentifier: 'a', pitch: 1, count: 4, limit: 3, format: 'Classic Constructed', legendary: false, restricted: false },
    };
    render(<DeckCauseLine legality={illegal([copies, ...(NO_WORDS[0]![1] ?? [])] as IDeckLegality['details'])} />);

    expect(screen.getByTestId('deck-cause')).toHaveTextContent('1 carta com 4 cópias e mais 1');
  });
});
