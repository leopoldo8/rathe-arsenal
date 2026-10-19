import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { ICardImage } from './dtos/card-list.dto';

export interface ILineCardInfo {
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly type: string;
  readonly imageUrl: ICardImage | null;
}

export function toCardImage(card: ICatalogCard | undefined): ICardImage | null {
  if (!card?.imageUrl) return null;
  return {
    small: card.imageUrl.small,
    large: card.imageUrl.large,
    sources: card.imageUrl.sources.map((source) => ({ ...source })),
  };
}

/** A card dropped from the catalog keeps its line: the identifier stands in for the name. */
export function lookupCardInfo(cardIdentifier: string): ILineCardInfo {
  const card = catalog.indices.byIdentifier.get(cardIdentifier);
  const pitch = card?.pitch;
  return {
    name: card?.name ?? cardIdentifier,
    pitch: pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null,
    type: card?.types[0] ?? 'unknown',
    imageUrl: toCardImage(card),
  };
}
