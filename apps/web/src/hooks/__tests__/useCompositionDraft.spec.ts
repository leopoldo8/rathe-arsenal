/**
 * Tests for useCompositionDraft hook.
 *
 * Covers all actions, isDirty, changeCount, reset, and applyDraft.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCompositionDraft,
  type ICompositionDraftInitialPayload,
} from '../useCompositionDraft';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INITIAL_PAYLOAD: ICompositionDraftInitialPayload = {
  cards: [
    {
      cardIdentifier: 'pummel-red-dyn',
      name: 'Pummel',
      quantity: 3,
      slot: 'action',
      pitch: 1,
      cost: 2,
      type: 'attack',
      imageUrl: null,
      legalFormats: ['Classic Constructed', 'Blitz'],
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

const MOCK_CARD_RESULT = {
  cardIdentifier: 'enlightened-strike-dyn',
  name: 'Enlightened Strike',
  pitch: 1,
  classes: ['ninja'],
  types: ['attack'],
  ownedQuantity: 2,
  imageUrl: null,
  legalFormats: ['Classic Constructed'],
  legalHeroes: [],
  bannedFormats: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCompositionDraft — initial state', () => {
  it('initializes with cards from the payload', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    expect(result.current.draft.cards).toHaveLength(1);
    expect(result.current.draft.cards[0]!.cardIdentifier).toBe('pummel-red-dyn');
  });

  it('initializes heroIdentifier from payload', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    expect(result.current.draft.heroIdentifier).toBe('katsu-the-wanderer-wtr');
  });

  it('initializes format from payload', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    expect(result.current.draft.format).toBe('Classic Constructed');
  });

  it('isDirty is false at initialization', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('changeCount is 0 at initialization', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    expect(result.current.changeCount).toBe(0);
  });
});

describe('useCompositionDraft — setHero', () => {
  it('updates heroIdentifier', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });
    expect(result.current.draft.heroIdentifier).toBe('dorinthea-ironsong-wtr');
  });

  it('marks isDirty when hero changes', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('increments changeCount by 1 when hero changes', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });
    expect(result.current.changeCount).toBe(1);
  });

  it('allows setting hero to null', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero(null);
    });
    expect(result.current.draft.heroIdentifier).toBeNull();
    expect(result.current.isDirty).toBe(true);
  });
});

describe('useCompositionDraft — setFormat', () => {
  it('updates format', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setFormat('Blitz');
    });
    expect(result.current.draft.format).toBe('Blitz');
  });

  it('marks isDirty when format changes', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setFormat('Blitz');
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('increments changeCount by 1 for format change', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setFormat('Blitz');
    });
    expect(result.current.changeCount).toBe(1);
  });
});

describe('useCompositionDraft — addCard', () => {
  it('adds a new card to the draft', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.addCard(MOCK_CARD_RESULT, 'mainboard');
    });
    expect(result.current.draft.cards).toHaveLength(2);
    expect(
      result.current.draft.cards.find((c) => c.cardIdentifier === 'enlightened-strike-dyn'),
    ).toBeDefined();
  });

  it('increments quantity when adding an existing card at the same slot', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    // Add same card twice
    const pummelResult = {
      ...MOCK_CARD_RESULT,
      cardIdentifier: 'pummel-red-dyn',
      name: 'Pummel',
    };
    act(() => {
      result.current.addCard(pummelResult, 'mainboard');
    });
    // The existing pummel has qty 3, adding again should push to 4
    const pummel = result.current.draft.cards.find(
      (c) => c.cardIdentifier === 'pummel-red-dyn',
    );
    expect(pummel?.quantity).toBe(4);
    expect(result.current.draft.cards).toHaveLength(1);
  });

  it('marks isDirty after adding a card', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.addCard(MOCK_CARD_RESULT, 'mainboard');
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('increments changeCount for a new card', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.addCard(MOCK_CARD_RESULT, 'mainboard');
    });
    expect(result.current.changeCount).toBe(1);
  });
});

describe('useCompositionDraft — updateQuantity', () => {
  it('updates the quantity of an existing card', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.updateQuantity('pummel-red-dyn', 'mainboard', 2);
    });
    const card = result.current.draft.cards.find(
      (c) => c.cardIdentifier === 'pummel-red-dyn',
    );
    expect(card?.quantity).toBe(2);
  });

  it('removes the card when quantity is set to 0', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.updateQuantity('pummel-red-dyn', 'mainboard', 0);
    });
    expect(result.current.draft.cards).toHaveLength(0);
  });

  it('marks isDirty after quantity change', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.updateQuantity('pummel-red-dyn', 'mainboard', 2);
    });
    expect(result.current.isDirty).toBe(true);
  });
});

describe('useCompositionDraft — removeCard', () => {
  it('removes the card from the draft', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.removeCard('pummel-red-dyn', 'mainboard');
    });
    expect(result.current.draft.cards).toHaveLength(0);
  });

  it('marks isDirty after removal', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.removeCard('pummel-red-dyn', 'mainboard');
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('increments changeCount for removal', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.removeCard('pummel-red-dyn', 'mainboard');
    });
    expect(result.current.changeCount).toBe(1);
  });
});

describe('useCompositionDraft — removeIllegalCards', () => {
  it('removes cards whose identifiers are in the illegal set', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.removeIllegalCards(new Set(['pummel-red-dyn']));
    });
    expect(result.current.draft.cards).toHaveLength(0);
  });

  it('keeps cards not in the illegal set', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.removeIllegalCards(new Set(['other-card-id']));
    });
    expect(result.current.draft.cards).toHaveLength(1);
  });
});

describe('useCompositionDraft — changeCount accumulation', () => {
  it('sums hero change + format change + qty change', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
    });
    act(() => {
      result.current.setFormat('Blitz');
    });
    act(() => {
      result.current.updateQuantity('pummel-red-dyn', 'mainboard', 2);
    });
    // hero change (1) + format change (1) + qty change (1) = 3
    expect(result.current.changeCount).toBe(3);
  });
});

describe('useCompositionDraft — reset', () => {
  it('resets the draft to the initial state', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    act(() => {
      result.current.setHero('dorinthea-ironsong-wtr');
      result.current.addCard(MOCK_CARD_RESULT, 'mainboard');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.draft.heroIdentifier).toBe('katsu-the-wanderer-wtr');
    expect(result.current.draft.cards).toHaveLength(1);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.changeCount).toBe(0);
  });
});

describe('useCompositionDraft — applyDraft', () => {
  it('replaces the current draft entirely', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('deck-1', INITIAL_PAYLOAD),
    );
    const newDraft = {
      cards: [],
      heroIdentifier: 'dorinthea-ironsong-wtr',
      format: 'Blitz',
    };
    act(() => {
      result.current.applyDraft(newDraft);
    });
    expect(result.current.draft.heroIdentifier).toBe('dorinthea-ironsong-wtr');
    expect(result.current.draft.format).toBe('Blitz');
    expect(result.current.draft.cards).toHaveLength(0);
    expect(result.current.isDirty).toBe(true);
  });
});

describe('useCompositionDraft — empty deck (R22)', () => {
  it('initializes cleanly with no cards', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('scratch-deck-1', EMPTY_PAYLOAD),
    );
    expect(result.current.draft.cards).toHaveLength(0);
    expect(result.current.isDirty).toBe(false);
  });

  it('addCard works on empty deck', () => {
    const { result } = renderHook(() =>
      useCompositionDraft('scratch-deck-1', EMPTY_PAYLOAD),
    );
    act(() => {
      result.current.addCard(MOCK_CARD_RESULT, 'mainboard');
    });
    expect(result.current.draft.cards).toHaveLength(1);
    expect(result.current.isDirty).toBe(true);
  });
});
