import type { IShareMeta } from './share-meta-tags';

export interface ISharedDeckSummary {
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly sharerName: string;
  readonly totalCards: number;
}

export const GENERIC_TITLE = 'Rathe Arsenal';
export const GENERIC_DESCRIPTION = 'Veja se o seu deck de Flesh and Blood está pronto.';

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function buildDeckShareMeta(
  deck: ISharedDeckSummary,
  token: string,
  baseUrl: string,
): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: `${deck.name} - ${deck.hero} (${deck.format})`,
    description: `Deck de ${deck.sharerName} no Rathe Arsenal - ${deck.totalCards} cartas`,
    imageUrl: `${base}/api/shared/decks/${token}/image`,
    pageUrl: `${base}/d/${token}`,
  };
}

// The image route answers any token that is not live with the generic image, so a dead link needs no route of its own.
const GENERIC_IMAGE_TOKEN = 'unavailable';

export function buildGenericShareMeta(baseUrl: string): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: GENERIC_TITLE,
    description: GENERIC_DESCRIPTION,
    imageUrl: `${base}/api/shared/decks/${GENERIC_IMAGE_TOKEN}/image`,
    pageUrl: base,
  };
}
