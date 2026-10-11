import type { IAlternativeImageUrl } from '../../../api/replacements';

export interface IRecommendationDeckCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly slot: string;
  readonly pitch: number | null;
  readonly cost: number | null;
  readonly imageUrl: IAlternativeImageUrl | null;
}

const PITCH_LABEL_KEY: Readonly<Record<number, string>> = {
  1: 'library.pitchRedLabel',
  2: 'library.pitchYellowLabel',
  3: 'library.pitchBlueLabel',
};

/** "Name (Red)": cards that differ only by pitch share a name, so the pitch is part of how a card is named here. */
export function withPitch(name: string, pitch: number | null, t: (key: string) => string): string {
  const key = pitch === null ? undefined : PITCH_LABEL_KEY[pitch];
  return key === undefined ? name : `${name} (${t(key)})`;
}

export function imageSources(imageUrl: IAlternativeImageUrl | null, size: 'small' | 'large'): string[] {
  if (imageUrl === null) return [];
  const variants = imageUrl.sources.length > 0 ? imageUrl.sources : [imageUrl];
  return variants.map((variant) => variant[size]);
}

export const CARD_BACK_SRC = `${import.meta.env.BASE_URL}images/card-back.webp`;
