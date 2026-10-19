import { capQuantity, findMergeCandidate, groupByCard } from '../line-math';

describe('line math', () => {
  it('caps quantities at 20', () => {
    expect(capQuantity(25)).toBe(20);
    expect(capQuantity(3)).toBe(3);
  });

  it('groups by card keeping first-seen order and capping', () => {
    expect(
      groupByCard([
        { cardIdentifier: 'b', quantity: 2 },
        { cardIdentifier: 'a', quantity: 15 },
        { cardIdentifier: 'b', quantity: 1 },
        { cardIdentifier: 'a', quantity: 10 },
      ]),
    ).toEqual([
      { cardIdentifier: 'b', quantity: 3 },
      { cardIdentifier: 'a', quantity: 20 },
    ]);
  });

  describe('findMergeCandidate', () => {
    const lines = [
      { id: 1, cardIdentifier: 'a', printing: null, condition: null, sold: true },
      { id: 2, cardIdentifier: 'a', printing: 'A1', condition: 'NM', sold: false },
      { id: 3, cardIdentifier: 'a', printing: null, condition: null, sold: false },
    ];

    it('merges want lines by card alone, skipping sold lines', () => {
      expect(findMergeCandidate('want', lines, { cardIdentifier: 'a', printing: null, condition: null })?.id).toBe(2);
    });

    it('merges sell lines by card, printing and condition with nulls equal', () => {
      expect(findMergeCandidate('sell', lines, { cardIdentifier: 'a', printing: null, condition: null })?.id).toBe(3);
      expect(findMergeCandidate('sell', lines, { cardIdentifier: 'a', printing: 'A1', condition: 'LP' })).toBeUndefined();
    });
  });
});
