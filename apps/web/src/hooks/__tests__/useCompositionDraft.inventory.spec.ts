/**
 * The inventory of a deck line in the composition draft (door 3): copies carried outside the starting
 * deck, kept beside the deck copies in one row per card and slot.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompositionDraft, type ICompositionDraftInitialPayload } from '../useCompositionDraft';
import { compositionDraftPayloadSchema } from '../useCompositionDraft.schema';

const CARD = {
  name: 'Pack Hunt',
  slot: 'mainboard',
  pitch: 1,
  cost: 2,
  type: 'Action',
  imageUrl: null,
  legalFormats: ['Classic Constructed'],
  legalHeroes: [],
  bannedFormats: [],
};

function payloadOf(cards: ICompositionDraftInitialPayload['cards']): ICompositionDraftInitialPayload {
  return { cards, heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' };
}

const THREE_IN_THE_DECK = payloadOf([{ ...CARD, cardIdentifier: 'pack-hunt-red', quantity: 3 }]);

function rowOf(result: { current: ReturnType<typeof useCompositionDraft> }, cardIdentifier: string) {
  return result.current.draft.cards.find((card) => card.cardIdentifier === cardIdentifier);
}

describe('useCompositionDraft with an inventory', () => {
  it('reads the inventory quantity of a payload row and keeps a card that is only in the inventory', () => {
    const { result } = renderHook(() =>
      useCompositionDraft(
        1,
        payloadOf([
          { ...CARD, cardIdentifier: 'pack-hunt-red', quantity: 3, inventoryQuantity: 1 },
          { ...CARD, cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 2 },
        ]),
      ),
    );

    expect(rowOf(result, 'pack-hunt-red')).toMatchObject({ quantity: 3, inventoryQuantity: 1 });
    expect(rowOf(result, 'snatch-red')).toMatchObject({ quantity: 0, inventoryQuantity: 2 });
    expect(result.current.draft.cards).toHaveLength(2);
  });

  it('keeps the row when the deck copies reach 0 but the inventory still holds copies', () => {
    const { result } = renderHook(() =>
      useCompositionDraft(1, payloadOf([{ ...CARD, cardIdentifier: 'pack-hunt-red', quantity: 1, inventoryQuantity: 2 }])),
    );

    act(() => result.current.updateQuantity('pack-hunt-red', 'mainboard', 0));

    expect(rowOf(result, 'pack-hunt-red')).toMatchObject({ quantity: 0, inventoryQuantity: 2 });
  });

  it('removes the row once neither the deck nor the inventory holds a copy', () => {
    const { result } = renderHook(() =>
      useCompositionDraft(1, payloadOf([{ ...CARD, cardIdentifier: 'pack-hunt-red', quantity: 0, inventoryQuantity: 1 }])),
    );

    act(() => result.current.updateInventoryQuantity('pack-hunt-red', 'mainboard', 0));

    expect(rowOf(result, 'pack-hunt-red')).toBeUndefined();
  });

  it('moves one copy, or all of them, between the deck and the inventory', () => {
    const { result } = renderHook(() => useCompositionDraft(1, THREE_IN_THE_DECK));

    act(() => result.current.moveCopies('pack-hunt-red', 'mainboard', 'deck', 1));
    expect(rowOf(result, 'pack-hunt-red')).toMatchObject({ quantity: 2, inventoryQuantity: 1 });

    act(() => result.current.moveCopies('pack-hunt-red', 'mainboard', 'deck', 2));
    expect(rowOf(result, 'pack-hunt-red')).toMatchObject({ quantity: 0, inventoryQuantity: 3 });

    act(() => result.current.moveCopies('pack-hunt-red', 'mainboard', 'inventory', 3));
    expect(rowOf(result, 'pack-hunt-red')).toMatchObject({ quantity: 3, inventoryQuantity: 0 });
  });

  it('counts a change of the inventory as an unsaved change', () => {
    const { result } = renderHook(() => useCompositionDraft(1, THREE_IN_THE_DECK));
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.updateInventoryQuantity('pack-hunt-red', 'mainboard', 1));

    expect(result.current.isDirty).toBe(true);
    expect(result.current.changeCount).toBe(1);
  });

  it('stores an inventory-only row in a draft the schema accepts', () => {
    const parsed = compositionDraftPayloadSchema.safeParse({
      version: 'v1',
      heroIdentifier: 'katsu-the-wanderer',
      format: 'Classic Constructed',
      cards: [
        { cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 3, slot: 'mainboard' },
        { cardIdentifier: 'pack-hunt-red', quantity: 3, slot: 'mainboard' },
      ],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.cards.map((card) => card.inventoryQuantity)).toEqual([3, 0]);
  });

  it('rejects a stored row with no copy at all', () => {
    const parsed = compositionDraftPayloadSchema.safeParse({
      version: 'v1',
      heroIdentifier: null,
      format: 'Blitz',
      cards: [{ cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 0, slot: 'mainboard' }],
    });

    expect(parsed.success).toBe(false);
  });
});
