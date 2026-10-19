import { computeShareImageHash, type IShareImageHashInput } from '../share-image-hash';

const BASE: IShareImageHashInput = {
  intent: 'deck',
  name: 'Blades',
  hero: 'Dorinthea',
  format: 'CC',
  sharerName: 'Rodrigo',
  totalCards: 60,
  missingCount: 0,
  drawnCardIdentifiers: ['a', 'b'],
  blockedCardIdentifiers: [],
  shareUrl: 'https://ra.example/d/tok',
};

describe('computeShareImageHash', () => {
  it('is stable for identical input', () => {
    expect(computeShareImageHash(BASE)).toBe(computeShareImageHash({ ...BASE }));
  });

  it.each<[string, Partial<IShareImageHashInput>]>([
    ['intent', { intent: 'missing' }],
    ['missing count', { missingCount: 3 }],
    ['display name', { sharerName: 'Rodrigo H.' }],
    ['deck name', { name: 'Blades 2' }],
    ['card count', { totalCards: 61 }],
    ['drawn cards', { drawnCardIdentifiers: ['a', 'c'] }],
    ['card order', { drawnCardIdentifiers: ['b', 'a'] }],
    ['blocked set', { blockedCardIdentifiers: ['b'] }],
    ['share url', { shareUrl: 'https://ra.example/d/other' }],
  ])('changes when the %s changes', (_label, change) => {
    expect(computeShareImageHash({ ...BASE, ...change })).not.toBe(computeShareImageHash(BASE));
  });

  it('ignores the order in which blocked cards are listed', () => {
    const one = computeShareImageHash({ ...BASE, blockedCardIdentifiers: ['x', 'y'] });
    const two = computeShareImageHash({ ...BASE, blockedCardIdentifiers: ['y', 'x'] });

    expect(one).toBe(two);
  });
});
