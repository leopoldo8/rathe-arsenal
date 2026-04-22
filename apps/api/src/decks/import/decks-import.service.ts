import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { FabraryService } from '../../fabrary/fabrary.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SourcesService } from '../../collection/sources/sources.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { parseFabraryUrl } from '../../fabrary/parse-url';
import { ImportDecksRequestDto } from './dtos/import-decks.request.dto';
import {
  IImportDecksResponse,
  IImportError,
  IImportedDeck,
  ISkippedUrl,
} from './dtos/import-decks.response.dto';
import { aggregateInventory } from './aggregate-inventory';

interface IParsedUrl {
  readonly url: string;
  readonly ulid: string;
}

@Injectable()
export class DecksImportService {
  private readonly logger = new Logger(DecksImportService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly fabraryService: FabraryService,
    private readonly substitutionService: SubstitutionService,
    private readonly sourcesService: SourcesService,
  ) {}

  async run(
    dto: ImportDecksRequestDto,
    user: { userId: string },
  ): Promise<IImportDecksResponse> {
    const errors: IImportError[] = [];
    const skipped: ISkippedUrl[] = [];

    // Step 1: Deduplicate URLs
    const { unique, duplicates } = this.deduplicateUrls(dto.urls);
    for (const url of duplicates) {
      skipped.push({ url, reason: 'DUPLICATE_IN_REQUEST' });
    }

    // Step 2: Parse URLs and fetch decks
    const parsed: IParsedUrl[] = [];
    for (const url of unique) {
      try {
        const ulid = parseFabraryUrl(url);
        parsed.push({ url, ulid });
      } catch (error) {
        errors.push({
          url,
          code: (error as { code?: string }).code ?? 'PARSE_ERROR',
          message: (error as Error).message,
        });
      }
    }

    const fetchedDecks: Array<{ url: string; deck: IDeckImportDto }> = [];
    for (const { url, ulid } of parsed) {
      try {
        const deck = await this.fabraryService.fetchDeck(ulid);
        fetchedDecks.push({ url, deck });
      } catch (error) {
        errors.push({
          url,
          code: (error as { code?: string }).code ?? 'FETCH_ERROR',
          message: (error as Error).message,
        });
      }
    }

    // Step 3: Check for already-tracked decks
    const decksToImport: Array<{ url: string; deck: IDeckImportDto }> = [];
    for (const entry of fetchedDecks) {
      const existing = await this.dataSource
        .getRepository(TrackedDeckEntity)
        .findOne({
          where: { userId: user.userId, fabraryUlid: entry.deck.ulid },
        });

      if (existing) {
        skipped.push({ url: entry.url, reason: 'ALREADY_TRACKED' });
      } else {
        decksToImport.push(entry);
      }
    }

    if (decksToImport.length === 0) {
      return { imported: [], skipped, errors };
    }

    // Step 4: Aggregate inventory (max-wins) — only when seedInventory is true
    const shouldSeedInventory = dto.seedInventory !== false;
    const deckDtos = decksToImport.map((e) => e.deck);
    const inventoryMap = shouldSeedInventory ? aggregateInventory(deckDtos) : new Map<string, number>();

    // Step 5: Persist inside a transaction
    const savedDecks = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        // Upsert collection cards (skipped when seedInventory is false)
        if (shouldSeedInventory) {
          await this.upsertCollectionCards(manager, user.userId, inventoryMap);
        }

        // Insert tracked decks and deck cards
        const results: Array<{ trackedDeck: TrackedDeckEntity; deck: IDeckImportDto }> = [];
        for (const { deck } of decksToImport) {
          const trackedDeck = manager.create(TrackedDeckEntity, {
            userId: user.userId,
            fabraryUlid: deck.ulid,
            name: deck.name,
            hero: deck.hero.name,
            format: deck.format,
          });
          const saved = await manager.save(TrackedDeckEntity, trackedDeck);

          const allCardEntries = [
            ...deck.mainboard,
            ...deck.equipment,
            ...deck.weapons,
            {
              cardIdentifier: deck.hero.cardIdentifier,
              quantity: 1,
              slot: 'hero' as const,
            },
          ];

          const deckCards = allCardEntries.map((entry) =>
            manager.create(DeckCardEntity, {
              trackedDeckId: saved.id,
              cardIdentifier: entry.cardIdentifier,
              quantity: entry.quantity,
              slot: entry.slot,
            }),
          );
          await manager.save(DeckCardEntity, deckCards);

          results.push({ trackedDeck: saved, deck });
        }

        return results;
      },
    );

    // Step 6: Compute readiness (after commit, failures are non-fatal)
    const imported: IImportedDeck[] = [];
    for (const { trackedDeck, deck } of savedDecks) {
      let readinessSnapshot: IImportedDeck['readinessSnapshot'] = null;
      try {
        const snapshot = await this.substitutionService.computeAndStoreReadiness(
          trackedDeck.id,
          user.userId,
        );
        readinessSnapshot = {
          rawPercent: snapshot.rawPercent,
          effectivePercent: snapshot.effectivePercent,
        };
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to compute readiness after import',
          trackedDeckId: trackedDeck.id,
          error: (error as Error).message,
        });
      }

      imported.push({
        trackedDeckId: trackedDeck.id,
        name: deck.name,
        hero: deck.hero.name,
        format: deck.format,
        readinessSnapshot,
      });
    }

    // Step 7: Recompute readiness for existing decks when inventory changed
    if (shouldSeedInventory) {
      await this.recomputeExistingDecks(user.userId, savedDecks.map((d) => d.trackedDeck.id));
    }

    return { imported, skipped, errors };
  }

  private async recomputeExistingDecks(
    userId: string,
    excludeDeckIds: readonly number[],
  ): Promise<void> {
    const allDecks = await this.dataSource
      .getRepository(TrackedDeckEntity)
      .find({ where: { userId } });

    const existingDecks = allDecks.filter((d) => !excludeDeckIds.includes(d.id));

    for (const deck of existingDecks) {
      try {
        await this.substitutionService.computeAndStoreReadiness(deck.id, userId);
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to recompute readiness for existing deck after import',
          trackedDeckId: deck.id,
          error: (error as Error).message,
        });
      }
    }
  }

  private deduplicateUrls(urls: readonly string[]): {
    unique: string[];
    duplicates: string[];
  } {
    const seen = new Set<string>();
    const unique: string[] = [];
    const duplicates: string[] = [];

    for (const url of urls) {
      if (seen.has(url)) {
        duplicates.push(url);
      } else {
        seen.add(url);
        unique.push(url);
      }
    }

    return { unique, duplicates };
  }

  private async upsertCollectionCards(
    manager: EntityManager,
    userId: string,
    inventory: Map<string, number>,
  ): Promise<void> {
    if (inventory.size === 0) {
      return;
    }

    // Ensure the manual source exists within the outer transaction so the
    // find-or-create participates in the same DB context.
    const manualSource = await this.sourcesService.ensureManualSource(
      userId,
      manager,
    );

    for (const [cardIdentifier, quantity] of inventory) {
      // Scope the lookup to the manual source so rows from CSV uploads are
      // never overwritten by max-wins deck-import inventory seeding.
      const existing = await manager.findOne(CollectionCardEntity, {
        where: { userId, cardIdentifier, sourceId: manualSource.id },
      });

      if (existing) {
        if (quantity > existing.quantity) {
          await manager.update(
            CollectionCardEntity,
            { id: existing.id },
            { quantity },
          );
        }
      } else {
        const card = manager.create(CollectionCardEntity, {
          userId,
          cardIdentifier,
          sourceId: manualSource.id,
          quantity,
        });
        await manager.save(CollectionCardEntity, card);
      }
    }
  }
}
