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
    const none = { printingCode: '', edition: '', finish: '', condition: null };
    const lines = [
      { id: 1, cardIdentifier: 'a', ...none, sold: true },
      { id: 2, cardIdentifier: 'a', printingCode: 'A1', edition: '', finish: '', condition: 'NM', sold: false },
      { id: 3, cardIdentifier: 'a', ...none, sold: false },
    ];

    it('merges want lines by card alone, skipping sold lines', () => {
      expect(findMergeCandidate('want', lines, { cardIdentifier: 'a', ...none })?.id).toBe(2);
    });

    it('merges sell lines by card and the four version fields with nulls equal', () => {
      expect(findMergeCandidate('sell', lines, { cardIdentifier: 'a', ...none })?.id).toBe(3);
      expect(findMergeCandidate('sell', lines, { cardIdentifier: 'a', printingCode: 'A1', edition: '', finish: '', condition: 'LP' })).toBeUndefined();
    });

    it('keeps two finishes of one card apart', () => {
      const plain = [{ id: 4, cardIdentifier: 'a', printingCode: '', edition: '', finish: 'none', condition: null, sold: false }];

      expect(findMergeCandidate('sell', plain, { cardIdentifier: 'a', ...none })).toBeUndefined();
      expect(findMergeCandidate('sell', plain, { cardIdentifier: 'a', printingCode: '', edition: '', finish: 'none', condition: null })?.id).toBe(4);
    });
  });
});
