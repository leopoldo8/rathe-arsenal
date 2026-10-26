import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { FabraryService } from '../../fabrary/fabrary.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { importFinishedEntry } from '../../collection/imports/import-finished-log';
import { ImportWriterService, IImportCopy } from '../../collection/imports/import-writer.service';
import { NO_VERSION } from '../../collection/versions/copy-version';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { EFabraryErrorCode, FabraryImportError } from '../../fabrary/errors';
import { findFabraryDeckId } from '../../fabrary/parse-url';
import { ImportDecksRequestDto } from './dtos/import-decks.request.dto';
import { IFabraryDeckPreview, IImportDecksResponse, IImportedSource } from './dtos/import-decks.response.dto';
import { buildDeckLines } from './deck-lines';
import { aggregateInventory } from './aggregate-inventory';
import { RecommendationQueueService } from '../../recommendations/recommendation-queue.service';

const FABRARY_DECK_URL = 'https://fabrary.net/decks/';

@Injectable()
export class DecksImportService {
  private readonly logger = new Logger(DecksImportService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly fabraryService: FabraryService,
    private readonly substitutionService: SubstitutionService,
    private readonly importWriter: ImportWriterService,
    private readonly collectionRead: CollectionReadService,
    private readonly recommendationQueue: RecommendationQueueService,
  ) {}

  /**
   * Imports the deck behind the first Fabrary link in the text. The cards enter the collection only
   * when `ownsCards` is true, as one import of kind `fabrary`.
   */
  async run(dto: ImportDecksRequestDto, user: { userId: string }): Promise<IImportDecksResponse> {
    if (typeof dto.ownsCards !== 'boolean') {
      throw new BadRequestException({
        code: 'OWNERSHIP_ANSWER_REQUIRED',
        message: 'Say whether the cards are yours before importing the deck',
      });
    }
    const deck = await this.fetchDeckIn(dto.text);

    const existing = await this.dataSource
      .getRepository(TrackedDeckEntity)
      .findOne({ where: { userId: user.userId, fabraryUlid: deck.ulid } });
    if (existing) return { deckId: existing.id };

    const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
      const source = dto.ownsCards ? await this.createSource(manager, user.userId, deck) : undefined;
      const trackedDeck = await this.createDeck(manager, user.userId, deck);
      return { trackedDeck, source };
    });

    await this.computeReadiness(saved.trackedDeck.id, user.userId);
    if (saved.source !== undefined) await this.recomputeExistingDecks(user.userId, saved.trackedDeck.id);
    this.logger.log(
      importFinishedEntry({
        userId: user.userId,
        kind: 'fabrary',
        ready: aggregateInventory([deck]).size,
        ownership: dto.ownsCards,
      }),
    );

    return saved.source === undefined
      ? { deckId: saved.trackedDeck.id }
      : { deckId: saved.trackedDeck.id, source: saved.source };
  }

  /**
   * What the player is told before answering whose cards they are: the deck's name and size and how
   * many of its copies (deck and inventory) the collection already holds. Writes nothing.
   */
  async preview(text: string, user: { userId: string }): Promise<IFabraryDeckPreview> {
    const deck = await this.fetchDeckIn(text);
    const needed = aggregateInventory([deck]);
    const owned = await this.collectionRead.loadOwned(user.userId, [...needed.keys()]);
    let totalCards = 0;
    let ownedCards = 0;
    for (const [cardIdentifier, quantity] of needed) {
      totalCards += quantity;
      ownedCards += Math.min(quantity, owned.get(cardIdentifier) ?? 0);
    }
    return { name: deck.name, hero: deck.hero.name, format: deck.format, totalCards, ownedCards };
  }

  private async fetchDeckIn(text: string): Promise<IDeckImportDto> {
    const ulid = findFabraryDeckId(text);
    if (ulid === null) {
      throw new BadRequestException({ code: 'INVALID_URL', message: 'The text has no Fabrary deck link' });
    }
    return this.fetchDeck(ulid);
  }

  private async fetchDeck(ulid: string): Promise<IDeckImportDto> {
    try {
      return await this.fabraryService.fetchDeck(ulid);
    } catch (error) {
      // Fabrary answers a deck that does not exist, or is private, with an error payload; every
      // other failure (network, credentials) means Fabrary could not be asked.
      if (error instanceof FabraryImportError && error.code === EFabraryErrorCode.INVALID_PAYLOAD) {
        throw new NotFoundException({ code: 'FABRARY_DECK_NOT_FOUND', message: 'The deck does not exist or is private' });
      }
      this.logger.warn({ msg: 'Fabrary could not be reached', ulid, error: (error as Error).message });
      throw new BadGatewayException({ code: 'FABRARY_UNREACHABLE', message: 'Fabrary could not be reached' });
    }
  }

  private async createSource(manager: EntityManager, userId: string, deck: IDeckImportDto): Promise<IImportedSource> {
    const copies: IImportCopy[] = [...aggregateInventory([deck])].map(([cardIdentifier, quantity]) => ({
      cardIdentifier,
      quantity,
      ...NO_VERSION,
    }));
    const source = await this.importWriter.createImport(manager, {
      userId,
      kind: 'fabrary',
      label: `Fabrary: ${deck.name}`,
      sourceUrl: `${FABRARY_DECK_URL}${deck.ulid}`,
      copies,
      pending: [],
    });
    return {
      id: source.id,
      kind: source.kind,
      label: source.label ?? '',
      cardCount: copies.length,
      copies: copies.reduce((sum, copy) => sum + copy.quantity, 0),
    };
  }

  private async createDeck(manager: EntityManager, userId: string, deck: IDeckImportDto): Promise<TrackedDeckEntity> {
    const saved = await manager.save(
      TrackedDeckEntity,
      manager.create(TrackedDeckEntity, {
        userId,
        fabraryUlid: deck.ulid,
        name: deck.name,
        hero: deck.hero.name,
        heroIdentifier: deck.hero.cardIdentifier,
        format: deck.format,
      }),
    );
    const deckCards = buildDeckLines(deck).map((line) =>
      manager.create(DeckCardEntity, { trackedDeckId: saved.id, ...line }),
    );
    await manager.save(DeckCardEntity, deckCards);
    await this.recommendationQueue.enqueueAuto(manager, saved.id);
    return saved;
  }

  // After the commit, so a failure here never undoes the import.
  private async computeReadiness(deckId: number, userId: string): Promise<void> {
    try {
      await this.substitutionService.computeAndStoreReadiness(deckId, userId);
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to compute readiness after import',
        trackedDeckId: deckId,
        error: (error as Error).message,
      });
    }
  }

  private async recomputeExistingDecks(userId: string, importedDeckId: number): Promise<void> {
    const allDecks = await this.dataSource.getRepository(TrackedDeckEntity).find({ where: { userId } });
    for (const deck of allDecks.filter((candidate) => candidate.id !== importedDeckId)) {
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
}
