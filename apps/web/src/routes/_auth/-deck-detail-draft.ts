import type { IDeckDetailResponse } from '../../api/deck-detail';
import type { ICompositionDraftInitialPayload } from '../../hooks/useCompositionDraft';

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
      quantity: entry.quantity,
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
    })),
  };
}
