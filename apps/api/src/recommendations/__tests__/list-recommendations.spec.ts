import { listRecommendations } from '../list-recommendations';

describe('listRecommendations', () => {
  it('drops dismissed and deck cards and lists clear upgrades first by rank', () => {
    const rows = [
      { cardIdentifier: 'A', strength: 'consider' as const, rank: 1 },
      { cardIdentifier: 'B', strength: 'clear_upgrade' as const, rank: 2 },
      { cardIdentifier: 'C', strength: 'consider' as const, rank: 3 },
      { cardIdentifier: 'D', strength: 'clear_upgrade' as const, rank: 4 },
      { cardIdentifier: 'E', strength: 'consider' as const, rank: 5 },
      { cardIdentifier: 'F', strength: 'consider' as const, rank: 6 },
    ];

    const listed = listRecommendations(rows, new Set(['C']), new Set(['E']));

    expect(listed.map((row) => row.cardIdentifier)).toEqual(['B', 'D', 'A', 'F']);
    expect(listRecommendations(rows, new Set(), new Set()).map((row) => row.cardIdentifier)).toEqual(['B', 'D', 'A', 'C', 'E', 'F']);
  });
});
