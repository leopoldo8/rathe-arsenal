import { orderByRecommendations } from '../order-by-recommendations';

const group = ['P', 'Q', 'R', 'S'].map((cardIdentifier) => ({ cardIdentifier }));

describe('orderByRecommendations', () => {
  it('lifts run cards by rank and keeps membership', () => {
    const ordered = orderByRecommendations(group, new Map([['S', 1], ['Q', 4], ['X', 2]]));

    expect(ordered.map((card) => card.cardIdentifier)).toEqual(['S', 'Q', 'P', 'R']);
    expect(orderByRecommendations(group, new Map()).map((card) => card.cardIdentifier)).toEqual(['P', 'Q', 'R', 'S']);
    expect([...ordered].sort((a, b) => a.cardIdentifier.localeCompare(b.cardIdentifier))).toEqual(group);
  });
});
