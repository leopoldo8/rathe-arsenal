import { ICatalogCard, Keyword } from '@rathe-arsenal/engine';

export interface ICardLegalityFacts {
  readonly legalFormats: readonly string[];
  readonly legalHeroes: readonly string[];
  readonly bannedFormats: readonly string[];
  readonly restrictedFormats: readonly string[];
  readonly legalOverrides: readonly { readonly format: string; readonly heroes: readonly string[] }[];
  readonly specializations: readonly string[];
  readonly legendary: boolean;
}

/**
 * Everything the browser needs to run the engine's legality rules on a card it holds, as plain
 * strings so the web client stays free of the engine and the card data package.
 */
export function cardLegalityFacts(card: ICatalogCard): ICardLegalityFacts {
  return {
    legalFormats: [...card.legalFormats] as string[],
    legalHeroes: [...card.legalHeroes],
    bannedFormats: [...(card.bannedFormats ?? [])] as string[],
    restrictedFormats: [...(card.restrictedFormats ?? [])] as string[],
    legalOverrides: (card.legalOverrides ?? []).map((override) => ({
      format: override.format as string,
      heroes: [...override.heroes] as string[],
    })),
    specializations: [...(card.specializations ?? [])] as string[],
    legendary: (card.keywords as readonly string[]).includes(Keyword.Legendary),
  };
}
