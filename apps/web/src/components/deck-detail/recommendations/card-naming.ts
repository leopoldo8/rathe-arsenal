import type { IAlternativeImageUrl } from '../../../api/replacements';

export interface IRecommendationDeckCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly slot: string;
  readonly pitch: number | null;
  readonly cost: number | null;
  readonly imageUrl: IAlternativeImageUrl | null;
}

export function imageSources(imageUrl: IAlternativeImageUrl | null, size: 'small' | 'large'): string[] {
  if (imageUrl === null) return [];
  const variants = imageUrl.sources.length > 0 ? imageUrl.sources : [imageUrl];
  return variants.map((variant) => variant[size]);
}

export const CARD_BACK_SRC = `${import.meta.env.BASE_URL}images/card-back.webp`;
