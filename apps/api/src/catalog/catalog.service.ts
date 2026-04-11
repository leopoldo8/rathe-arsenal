import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  catalog,
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
} from '@rathe-arsenal/engine';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import {
  ISearchCardResult,
  ISearchCardsResponse,
} from './dtos/search-cards.dto';

const DEFAULT_SEARCH_LIMIT = 10;

// Card types that are not collectible in this context and must be excluded
// from the autocomplete search results.
const EXCLUDED_TYPES: ReadonlySet<string> = new Set(['Hero', 'Token']);

@Injectable()
export class CatalogService {
  private readonly catalog: ICatalog = catalog;

  constructor(
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
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

    const ownedQuantityByIdentifier = await this.loadOwnedQuantities(
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
    }));

    return { results };
  }

  private isExcludedType(types: readonly string[]): boolean {
    for (const t of types) {
      if (EXCLUDED_TYPES.has(t)) return true;
    }
    return false;
  }

  private async loadOwnedQuantities(
    userId: string,
    cardIdentifiers: readonly string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (cardIdentifiers.length === 0) return result;

    const rows = await this.collectionCardRepo.find({
      where: {
        userId,
        cardIdentifier: In([...cardIdentifiers]),
      },
    });

    for (const row of rows) {
      result.set(row.cardIdentifier, row.quantity);
    }

    return result;
  }
}
