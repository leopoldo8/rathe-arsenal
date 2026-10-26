import type { IDeckDetailResponse } from '../../api/deck-detail';
import type { ICompositionDraftInitialPayload } from '../../hooks/useCompositionDraft';

/** True for the deck page opened right after the deck was created, with nothing in it yet. */
export function isJustCreatedState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { justCreated?: unknown }).justCreated === true;
}

/** "Cancelar" throws the deck away only when it was created in this visit and still has no cards. */
export function shouldDiscardOnCancel(locationState: unknown, totalCards: number): boolean {
  return isJustCreatedState(locationState) && totalCards === 0;
}

export function buildDraftInitialPayload(
  deck: Pick<IDeckDetailResponse, 'heroIdentifier' | 'format'>,
  snapshot: IDeckDetailResponse['latestSnapshot'],
): ICompositionDraftInitialPayload {
  const heroIdentifier = deck.heroIdentifier ?? null;
  if (!snapshot) return { cards: [], heroIdentifier, format: deck.format };

  const entries = [...snapshot.breakdown.exact, ...(snapshot.breakdown.notOwned ?? snapshot.breakdown.missing)];
  return {
    heroIdentifier,
    format: deck.format,
    cards: entries.map((entry) => ({
      cardIdentifier: entry.cardIdentifier,
      name: entry.name,
      // The entry counts the deck and the inventory together; its `inventoryQuantity` is the inventory's share.
      quantity: entry.quantity - (entry.inventoryQuantity ?? 0),
      inventoryQuantity: entry.inventoryQuantity ?? 0,
      slot: entry.slot,
      pitch: entry.pitch,
      cost: entry.cost ?? null,
      type: entry.type,
      imageUrl: entry.imageUrl
        ? { small: entry.imageUrl.small, large: entry.imageUrl.large, sources: entry.imageUrl.sources }
        : null,
      legalFormats: entry.legalFormats ?? [],
      legalHeroes: entry.legalHeroes ?? [],
      bannedFormats: entry.bannedFormats ?? [],
      ...(entry.restrictedFormats === undefined ? {} : { restrictedFormats: entry.restrictedFormats }),
      ...(entry.legalOverrides === undefined ? {} : { legalOverrides: entry.legalOverrides }),
      ...(entry.specializations === undefined ? {} : { specializations: entry.specializations }),
      ...(entry.legendary === undefined ? {} : { legendary: entry.legendary }),
    })),
  };
}
