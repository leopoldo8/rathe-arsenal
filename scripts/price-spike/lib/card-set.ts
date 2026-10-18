import type { ICardSetEntry, IRawPrinting } from './types';

interface IRawCard {
  readonly name: string;
  readonly printings: readonly IRawPrinting[];
}

export interface IDeckCards {
  readonly hero: string;
  readonly mainboard: readonly { readonly card: string }[];
}

export function distinctIdentifiers(decks: readonly IDeckCards[]): string[] {
  const all = decks.flatMap((d) => [d.hero, ...d.mainboard.map((e) => e.card)]);
  return [...new Set(all)].sort();
}

export function buildCardSet(
  identifiers: readonly string[],
  getRawCard: (identifier: string) => unknown,
): ICardSetEntry[] {
  return identifiers.map((cardIdentifier) => {
    const raw = getRawCard(cardIdentifier) as IRawCard;
    return {
      cardIdentifier,
      name: raw.name,
      printings: raw.printings.map((p) => ({
        identifier: p.identifier,
        set: p.set,
        rarity: p.rarity,
        foiling: p.foiling ?? 'Standard',
        edition: p.edition ?? null,
        productId: p.tcgplayer ? Number(p.tcgplayer.productId) : null,
      })),
    };
  });
}
