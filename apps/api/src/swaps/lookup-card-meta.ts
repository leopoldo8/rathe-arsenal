import { ICatalogCard } from '@rathe-arsenal/engine';
import { CatalogService } from '../catalog/catalog.service';

export interface ICardMeta {
  readonly name: string;
  readonly pitch: number | null;
  readonly type: string;
  readonly imageUrl: ICatalogCard['imageUrl'];
}

export function lookupCardMeta(catalogService: CatalogService, cardIdentifier: string): ICardMeta {
  try {
    const card = catalogService.getCard(cardIdentifier);
    return {
      name: card.name || cardIdentifier,
      pitch: card.pitch,
      type: card.types?.[0] ?? 'unknown',
      imageUrl: card.imageUrl ?? null,
    };
  } catch {
    return { name: cardIdentifier, pitch: null, type: 'unknown', imageUrl: null };
  }
}
