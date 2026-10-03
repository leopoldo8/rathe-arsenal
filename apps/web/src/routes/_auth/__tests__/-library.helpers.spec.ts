import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateLibrarySearch } from '../-library.helpers';
import {
  CARD_SIZE_STORAGE_KEY,
  readStoredCardSize,
  writeStoredCardSize,
} from '../../../components/library/LibraryFilterRail.constants';

describe('card size persistence (LIB-02)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the stored size when the URL carries no cardSize', () => {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, '200');
    expect(validateLibrarySearch({}).cardSize).toBe(200);
  });

  it('lets the URL param win over the stored size', () => {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, '200');
    expect(validateLibrarySearch({ cardSize: 80 }).cardSize).toBe(80);
  });

  it('falls back to 120 when nothing is stored', () => {
    expect(validateLibrarySearch({}).cardSize).toBe(120);
  });

  it('snaps a stored off-step value to the nearest step', () => {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, '170');
    expect(readStoredCardSize()).toBe(160);
  });

  it('ignores a non-numeric stored value', () => {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, 'huge');
    expect(readStoredCardSize()).toBeNull();
    expect(validateLibrarySearch({}).cardSize).toBe(120);
  });

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredCardSize()).toBeNull();
    expect(() => writeStoredCardSize(160)).not.toThrow();
    expect(validateLibrarySearch({}).cardSize).toBe(120);
  });

  it('round-trips through writeStoredCardSize', () => {
    writeStoredCardSize(240);
    expect(window.localStorage.getItem(CARD_SIZE_STORAGE_KEY)).toBe('240');
    expect(validateLibrarySearch({}).cardSize).toBe(240);
  });
});
