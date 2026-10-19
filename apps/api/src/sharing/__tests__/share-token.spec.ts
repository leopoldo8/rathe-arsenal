import { generateShareToken, isShareTokenShape } from '../share-token';

describe('share token', () => {
  it('generates 22-character url-safe tokens that pass the shape check', () => {
    const tokens = Array.from({ length: 50 }, () => generateShareToken());

    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(isShareTokenShape(token)).toBe(true);
    }
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(23)],
    ['padding', `${'a'.repeat(20)}==`],
    ['path characters', `${'a'.repeat(20)}/.`],
    ['not a string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isShareTokenShape(value)).toBe(false);
  });
});
