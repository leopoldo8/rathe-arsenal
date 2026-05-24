/**
 * Tests for useCompositionDraft — U13 localStorage persistence.
 *
 * Covers:
 *  - 500ms debounce write to localStorage
 *  - Faster-than-debounce writes batched (single write per window)
 *  - readStoredDraft happy path
 *  - readStoredDraft: tampered payload (Zod fails → silent discard)
 *  - readStoredDraft: wrong schema version → discard
 *  - readStoredDraft: corrupt JSON → discard
 *  - clearStoredDraft removes key
 *  - Two-tab race: Tab1 Save clears key; Tab2 next keystroke writes its draft back
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCompositionDraft,
  readStoredDraft,
  clearStoredDraft,
  draftStorageKey,
  type ICompositionDraftInitialPayload,
} from '../useCompositionDraft';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => { store[key] = value; }),
    removeItem: vi.fn((key: string): void => { delete store[key]; }),
    clear: (): void => { store = {}; },
    keys: (): string[] => Object.keys(store),
    get length(): number { return Object.keys(store).length; },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DECK_ID = 'deck-42';

const INITIAL_PAYLOAD: ICompositionDraftInitialPayload = {
  cards: [
    {
      cardIdentifier: 'pummel-red-dyn',
      name: 'Pummel',
      quantity: 2,
      slot: 'action',
      pitch: 1,
      cost: 2,
      type: 'attack',
      imageUrl: null,
      legalFormats: [],
      legalHeroes: [],
      bannedFormats: [],
    },
  ],
  heroIdentifier: 'katsu-the-wanderer-wtr',
  format: 'Classic Constructed',
};

const EMPTY_PAYLOAD: ICompositionDraftInitialPayload = {
  cards: [],
  heroIdentifier: null,
  format: 'Classic Constructed',
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// draftStorageKey
// ---------------------------------------------------------------------------

describe('draftStorageKey', () => {
  it('returns the correct key pattern', () => {
    expect(draftStorageKey('deck-1')).toBe('ra-deck-draft-deck-1');
    expect(draftStorageKey(42)).toBe('ra-deck-draft-42');
  });
});

// ---------------------------------------------------------------------------
// readStoredDraft — happy path
// ---------------------------------------------------------------------------

describe('readStoredDraft — happy path', () => {
  it('returns validated payload when key exists with valid v1 schema', () => {
    const payload = {
      version: 'v1',
      heroIdentifier: 'katsu-the-wanderer-wtr',
      format: 'Classic Constructed',
      cards: [{ cardIdentifier: 'pummel-red-dyn', quantity: 2, slot: 'mainboard' }],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));

    const result = readStoredDraft(DECK_ID);
    expect(result).not.toBeNull();
    expect(result?.version).toBe('v1');
    expect(result?.heroIdentifier).toBe('katsu-the-wanderer-wtr');
    expect(result?.cards).toHaveLength(1);
  });

  it('returns null when key does not exist', () => {
    const result = readStoredDraft('nonexistent-deck');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readStoredDraft — silent discard paths
// ---------------------------------------------------------------------------

describe('readStoredDraft — silent discard', () => {
  it('discards and removes key when JSON is corrupt', () => {
    localStorageMock.setItem(draftStorageKey(DECK_ID), '{invalid json{{');
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();
  });

  it('discards and removes key when cards is not an array (tampered payload)', () => {
    const payload = {
      version: 'v1',
      heroIdentifier: 'katsu',
      format: 'Classic Constructed',
      cards: 'not an array',
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();
  });

  it('discards when version is not v1 (schema version drift)', () => {
    const payload = {
      version: 'v2',
      heroIdentifier: 'katsu',
      format: 'Classic Constructed',
      cards: [],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();
  });

  it('discards when version field is missing', () => {
    const payload = {
      heroIdentifier: 'katsu',
      format: 'Classic Constructed',
      cards: [],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
  });

  it('discards when card quantity is out of range (> 4)', () => {
    const payload = {
      version: 'v1',
      heroIdentifier: 'katsu',
      format: 'Classic Constructed',
      cards: [{ cardIdentifier: 'pummel-red-dyn', quantity: 10, slot: 'mainboard' }],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
  });

  it('discards when slot is an invalid enum value', () => {
    const payload = {
      version: 'v1',
      heroIdentifier: 'katsu',
      format: 'Classic Constructed',
      cards: [{ cardIdentifier: 'pummel-red-dyn', quantity: 2, slot: 'invalid-slot' }],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));
    const result = readStoredDraft(DECK_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearStoredDraft
// ---------------------------------------------------------------------------

describe('clearStoredDraft', () => {
  it('removes the key from localStorage', () => {
    localStorageMock.setItem(draftStorageKey(DECK_ID), '{"version":"v1"}');
    clearStoredDraft(DECK_ID);
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();
  });

  it('does not throw when key does not exist', () => {
    expect(() => clearStoredDraft('nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useCompositionDraft — localStorage write debounce
// ---------------------------------------------------------------------------

describe('useCompositionDraft — 500ms debounce write', () => {
  it('writes to localStorage after 500ms', async () => {
    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );

    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });

    // Before 500ms: no write yet
    vi.advanceTimersByTime(499);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    // After 500ms: write should have happened
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      draftStorageKey(DECK_ID),
      expect.stringContaining('"version":"v1"'),
    );
  });

  it('batches multiple rapid changes — only one write per debounce window', () => {
    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );

    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });
    act(() => {
      result.current.setFormat('Blitz');
    });
    act(() => {
      result.current.setHero('briar-wildthorn-wtr');
    });

    // Still within debounce window — no write yet
    vi.advanceTimersByTime(499);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    // Flush the timer
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // Only one write should have occurred
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
  });

  it('writes the correct v1 payload shape', () => {
    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );

    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const raw = localStorageMock.setItem.mock.calls[0]![1] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.version).toBe('v1');
    expect(parsed.heroIdentifier).toBe('dorinthea-ironsong-wtr');
    expect(parsed.format).toBe('Classic Constructed');
    expect(Array.isArray(parsed.cards)).toBe(true);
  });

  it('does NOT write initial state on mount when draft matches the loaded payload', () => {
    // Regression guard: persisting a clean draft caused the DraftRestoreModal
    // to appear on the user's first-ever Edit entry for a freshly imported
    // deck, even though they had not made any changes. The write must be
    // gated on `isDirty`.
    renderHook(() => useCompositionDraft(DECK_ID, EMPTY_PAYLOAD));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearPersistedDraft (via hook)
// ---------------------------------------------------------------------------

describe('useCompositionDraft — clearPersistedDraft', () => {
  it('removes the localStorage key', () => {
    localStorageMock.setItem(draftStorageKey(DECK_ID), '{"version":"v1","heroIdentifier":null,"format":"Classic Constructed","cards":[]}');
    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.clearPersistedDraft();
    });
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPersistedDraft (via hook)
// ---------------------------------------------------------------------------

describe('useCompositionDraft — readPersistedDraft', () => {
  it('returns validated payload via hook method', () => {
    const payload = {
      version: 'v1',
      heroIdentifier: 'briar-wtr',
      format: 'Blitz',
      cards: [],
    };
    localStorageMock.setItem(draftStorageKey(DECK_ID), JSON.stringify(payload));

    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );
    const stored = result.current.readPersistedDraft();
    expect(stored).not.toBeNull();
    expect(stored?.heroIdentifier).toBe('briar-wtr');
  });
});

// ---------------------------------------------------------------------------
// Two-tab race documented behavior
// ---------------------------------------------------------------------------

describe('two-tab race — documented behavior', () => {
  it('Tab2 keystroke writes its own draft back after Tab1 Save clears it', () => {
    // Tab1 Save: clear the key
    localStorageMock.setItem(draftStorageKey(DECK_ID), '{"version":"v1","heroIdentifier":"katsu","format":"Classic Constructed","cards":[]}');
    clearStoredDraft(DECK_ID);
    expect(localStorageMock.getItem(draftStorageKey(DECK_ID))).toBeNull();

    // Tab2 still has its hook running — simulated by rendering a new hook
    // with its own draft state and waiting for the debounce write.
    const { result } = renderHook(() =>
      useCompositionDraft(DECK_ID, INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('briar-wtr');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // After Tab2's keystroke + debounce, its draft is back in localStorage.
    const stored = readStoredDraft(DECK_ID);
    expect(stored).not.toBeNull();
    expect(stored?.heroIdentifier).toBe('briar-wtr');
  });
});
