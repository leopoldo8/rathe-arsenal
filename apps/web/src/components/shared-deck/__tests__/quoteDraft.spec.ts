import { afterEach, describe, expect, it, vi } from 'vitest';
import { readQuoteDraft, writeQuoteDraft, type TQuoteDraft } from '../quoteDraft';

const DRAFT: TQuoteDraft = {
  'alpha-rampage-red': { have: 1, price: '120,00', note: 'Edição promo, condição NM' },
  'pack-hunt-red': { have: 3, price: '2,00', note: '' },
};

describe('the quote draft', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores the draft per token and starts empty without storage', () => {
    writeQuoteDraft('tokenA', DRAFT);

    expect(readQuoteDraft('tokenA')).toEqual(DRAFT);
    expect(readQuoteDraft('tokenB')).toEqual({});

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(readQuoteDraft('tokenA')).toEqual({});
    expect(() => writeQuoteDraft('tokenA', DRAFT)).not.toThrow();
  });

  it('starts empty from a stored value it cannot read', () => {
    localStorage.setItem('ra.quoteDraft.tokenA', '{not json');
    expect(readQuoteDraft('tokenA')).toEqual({});

    localStorage.setItem('ra.quoteDraft.tokenA', JSON.stringify({ 'pack-hunt-red': { have: 'many', price: 4, note: null } }));
    expect(readQuoteDraft('tokenA')).toEqual({});
  });
});
