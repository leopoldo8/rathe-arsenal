import { Injectable } from '@nestjs/common';
import {
  catalog,
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
  Type,
} from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import {
  ISearchCardResult,
  ISearchCardsResponse,
} from './dtos/search-cards.dto';
import { IHeroListItem, IHeroListResponse } from './dtos/hero-list-item.dto';

const DEFAULT_SEARCH_LIMIT = 10;

// Card types that are not collectible in this context and must be excluded
// from the autocomplete search results.
const EXCLUDED_TYPES: ReadonlySet<string> = new Set(['Hero', 'Token']);

// The Type.Hero enum value, used to filter hero cards in listHeroes().
const HERO_TYPE: Type = Type.Hero;

@Injectable()
export class CatalogService {
  private readonly catalog: ICatalog = catalog;

  constructor(
    private readonly collectionReadService: CollectionReadService,
  ) {}

  getCard(identifier: string): ICatalogCard {
    return this.catalog.getCard(identifier);
  }

  getCards(): readonly ICatalogCard[] {
    return this.catalog.cards;
  }

  getIndices(): ICatalogIndices {
    return this.catalog.indices;
  }

  getRawCard(identifier: string): unknown {
    return this.catalog.getRawCard(identifier);
  }

  /**
   * Returns a slim projection of every hero card in the catalog.
   *
   * The HeroDropdown in the web app calls this endpoint once per session so it
   * can render the hero picker without importing the engine (~9MB) client-side.
   * No pagination — the hero set is bounded (~143 records, ~22KB JSON).
   */
  listHeroes(): IHeroListResponse {
    const heroes: IHeroListItem[] = [];

    for (const card of this.catalog.cards) {
      if (!card.types.includes(HERO_TYPE)) continue;

      heroes.push({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        young: card.young,
        legalFormats: [...card.legalFormats] as string[],
        imageUrl: card.imageUrl
          ? {
              small: card.imageUrl.small,
              large: card.imageUrl.large,
              sources: card.imageUrl.sources.map((s) => ({
                small: s.small,
                large: s.large,
              })),
            }
          : null,
      });
    }

    return { heroes };
  }

  /**
   * Server-side card search. Matches by name, case-insensitive:
   * 1. Cards whose name starts with the query (highest priority)
   * 2. Cards whose name contains the query (fallback) — fills up to `limit`
   *
   * Excludes heroes and tokens. Returns `ownedQuantity` scoped to the
   * requesting user so the UI can render "x3 owned" badges inline.
   */
  async search(
    userId: string,
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<ISearchCardsResponse> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return { results: [] };
    }

    const startsWithMatches: ICatalogCard[] = [];
    const includesMatches: ICatalogCard[] = [];
    const seen = new Set<string>();

    for (const card of this.catalog.cards) {
      if (this.isExcludedType(card.types)) continue;

      // Collapse duplicates across pitch variants by cardIdentifier dedup.
      // The catalog already treats each identifier as a single card entry,
      // but we guard defensively in case the upstream data contains dups.
      if (seen.has(card.cardIdentifier)) continue;

      const lowerName = card.name.toLowerCase();
      if (lowerName.startsWith(needle)) {
        startsWithMatches.push(card);
        seen.add(card.cardIdentifier);
        if (startsWithMatches.length >= limit) break;
      }
    }

    if (startsWithMatches.length < limit) {
      for (const card of this.catalog.cards) {
        if (this.isExcludedType(card.types)) continue;
        if (seen.has(card.cardIdentifier)) continue;

        const lowerName = card.name.toLowerCase();
        if (!lowerName.startsWith(needle) && lowerName.includes(needle)) {
          includesMatches.push(card);
          seen.add(card.cardIdentifier);
          if (
            startsWithMatches.length + includesMatches.length >=
            limit
          ) {
            break;
          }
        }
      }
    }

    const matches: readonly ICatalogCard[] = [
      ...startsWithMatches,
      ...includesMatches,
    ].slice(0, limit);

    if (matches.length === 0) {
      return { results: [] };
    }

    const ownedQuantityByIdentifier = await this.collectionReadService.loadOwned(
      userId,
      matches.map((card) => card.cardIdentifier),
    );

    const results: readonly ISearchCardResult[] = matches.map((card) => ({
      cardIdentifier: card.cardIdentifier,
      name: card.name,
      pitch: card.pitch,
      classes: [...card.classes] as string[],
      types: [...card.types] as string[],
      ownedQuantity: ownedQuantityByIdentifier.get(card.cardIdentifier) ?? 0,
      // Strip the `sources` mirror list — autocomplete only needs the
      // canonical small/large pair. Falls back to <CardArt> SVG on load
      // failure rather than cycling alternative URLs.
      imageUrl: card.imageUrl
        ? { small: card.imageUrl.small, large: card.imageUrl.large }
        : null,
      // Legality fields for the Edit-mode cascade check (U12/U17).
      // Always serialized as arrays — never undefined — so the web client
      // can safely iterate without null-guards.
      legalFormats: [...card.legalFormats] as string[],
      legalHeroes: [...card.legalHeroes] as string[],
      bannedFormats: card.bannedFormats ? ([...card.bannedFormats] as string[]) : [],
    }));

    return { results };
  }

  private isExcludedType(types: readonly string[]): boolean {
    for (const t of types) {
      if (EXCLUDED_TYPES.has(t)) return true;
    }
    return false;
  }
}
