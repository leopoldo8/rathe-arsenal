import { rulesTextSimilarity } from '../src/substitution/text-similarity';

describe('rulesTextSimilarity', () => {
  it('is 1 for the same text and 0 for texts with no word in common', () => {
    expect(rulesTextSimilarity('Draw a card.', 'Draw a card.')).toBe(1);
    expect(rulesTextSimilarity('Draw a card.', 'Gain 1{h}.')).toBe(0);
  });

  it('ignores case, punctuation and resource symbols, and keeps bold keywords as words', () => {
    expect(rulesTextSimilarity('Gets +3{p}.\n\n**Go again**', 'gets +3 {r} go AGAIN')).toBe(1);
    expect(rulesTextSimilarity('Gets +3{p}. **Reload**', 'Gets +3{p}.')).toBeCloseTo(2 / 3);
  });

  it('is the share of distinct words the two texts have in common', () => {
    expect(rulesTextSimilarity('next arrow attack gets', 'next arrow attack draws')).toBeCloseTo(3 / 5);
  });

  it('is 0 when either text is empty or missing', () => {
    expect(rulesTextSimilarity('', 'Draw a card.')).toBe(0);
    expect(rulesTextSimilarity(undefined, undefined)).toBe(0);
  });
});
