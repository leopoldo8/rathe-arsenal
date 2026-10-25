import type { ICatalogCard } from '@rathe-arsenal/engine';
import { IRawPrinting } from '../../catalog/card-version-options';
import { ICardFacts, ICardLookup } from './line-reader.types';

/** The catalog calls the reader needs; `CatalogService` has all three. */
export interface ICatalogSource {
  getCards(): readonly ICatalogCard[];
  getCard(identifier: string): ICatalogCard;
  getRawCard(identifier: string): unknown;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Card names, pitches, printings and set codes from the catalog, indexed once on first use. */
export class CatalogCardLookup implements ICardLookup {
  private index: Map<string, string[]> | null = null;

  constructor(private readonly source: ICatalogSource) {}

  idsByName(normalizedName: string): readonly string[] {
    return this.names().get(normalizedName) ?? [];
  }

  distinctNames(): readonly string[] {
    return [...this.names().keys()];
  }

  card(cardIdentifier: string): ICardFacts {
    const card = this.source.getCard(cardIdentifier);
    return { name: card.name, pitch: card.pitch, imageUrl: card.imageUrl };
  }

  printings(cardIdentifier: string): readonly IRawPrinting[] {
    try {
      const raw = this.source.getRawCard(cardIdentifier) as { printings?: readonly IRawPrinting[] };
      return raw.printings ?? [];
    } catch {
      return [];
    }
  }

  matchesSet(cardIdentifier: string, set: string): boolean {
    const wanted = set.trim().toLowerCase();
    try {
      const raw = this.source.getRawCard(cardIdentifier) as { setIdentifiers?: string[] };
      return (raw.setIdentifiers ?? []).some((id) => id.slice(0, 3).toLowerCase() === wanted || id.toLowerCase() === wanted);
    } catch {
      return false;
    }
  }

  private names(): Map<string, string[]> {
    if (this.index !== null) return this.index;
    const built = new Map<string, string[]>();
    for (const card of this.source.getCards()) {
      const key = normalize(card.name);
      built.set(key, [...(built.get(key) ?? []), card.cardIdentifier]);
    }
    this.index = built;
    return built;
  }
}
