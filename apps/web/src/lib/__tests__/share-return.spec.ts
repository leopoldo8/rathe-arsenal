import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SHARE_RETURN_MAX_AGE_MS,
  SHARE_RETURN_STORAGE_KEY,
  clearShareReturn,
  isSafeReturnPath,
  readShareReturn,
  writeShareReturn,
} from '../share-return';

const TOKEN = 'k7QxN2mTp9aV4wLcAbCdEf';

describe('isSafeReturnPath', () => {
  it.each(['/d/abc', `/d/${TOKEN}`, '/l/abc', '/d/abc?view=missing'])('accepts %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(true);
  });

  it.each([
    '/',
    '/home',
    '/d/',
    '/l/',
    '/decks/1',
    'd/abc',
    'https://evil.example/d/abc',
    '//evil.example/d/abc',
    '/d//evil.example',
    '/d/\\evil.example',
    '/d/a b',
    '/dd/abc',
    '',
    null,
    undefined,
    42,
  ])('rejects %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(false);
  });
});

describe('share return storage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('round-trips the shared page the visitor came from', () => {
    writeShareReturn(TOKEN);
    expect(readShareReturn()).toEqual({ returnTo: `/d/${TOKEN}`, shareToken: TOKEN });
  });

  it('stores the documented key and shape', () => {
    writeShareReturn(TOKEN);
    expect(JSON.parse(localStorage.getItem(SHARE_RETURN_STORAGE_KEY) ?? 'null')).toEqual({
      returnTo: `/d/${TOKEN}`,
      shareToken: TOKEN,
      savedAt: expect.any(Number),
    });
  });

  it('ignores a token with an unexpected shape', () => {
    writeShareReturn('../evil');
    expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toBeNull();
  });

  it('ignores a stored value whose returnTo is not a shared path', () => {
    localStorage.setItem(
      SHARE_RETURN_STORAGE_KEY,
      JSON.stringify({ returnTo: 'https://evil.example', shareToken: TOKEN, savedAt: Date.now() }),
    );
    expect(readShareReturn()).toBeNull();
  });

  it('ignores malformed JSON', () => {
    localStorage.setItem(SHARE_RETURN_STORAGE_KEY, '{nope');
    expect(readShareReturn()).toBeNull();
  });

  it('still returns an entry just inside the 7-day window', () => {
    vi.useFakeTimers();
    writeShareReturn(TOKEN);
    vi.advanceTimersByTime(SHARE_RETURN_MAX_AGE_MS - 1000);
    expect(readShareReturn()).not.toBeNull();
    vi.useRealTimers();
  });

  it('ignores and clears an entry older than 7 days', () => {
    vi.useFakeTimers();
    writeShareReturn(TOKEN);
    vi.advanceTimersByTime(SHARE_RETURN_MAX_AGE_MS + 1000);
    expect(readShareReturn()).toBeNull();
    expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toBeNull();
    vi.useRealTimers();
  });

  it('treats an entry with no timestamp as expired and clears it', () => {
    localStorage.setItem(SHARE_RETURN_STORAGE_KEY, JSON.stringify({ returnTo: `/d/${TOKEN}`, shareToken: TOKEN }));
    expect(readShareReturn()).toBeNull();
    expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toBeNull();
  });

  it('clears the key', () => {
    writeShareReturn(TOKEN);
    clearShareReturn();
    expect(readShareReturn()).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeShareReturn(TOKEN)).not.toThrow();
    expect(readShareReturn()).toBeNull();
    expect(() => clearShareReturn()).not.toThrow();
  });
});
