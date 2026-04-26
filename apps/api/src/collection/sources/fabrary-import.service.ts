import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { FabraryService } from '../../fabrary/fabrary.service';
import { parseFabraryUrl } from '../../fabrary/parse-url';
import {
  FabraryImportError,
  EFabraryErrorCode,
} from '../../fabrary/errors';
import {
  IDeckImportDto,
  IDeckCardEntry,
} from '../../fabrary/dtos/deck-import.dto';
import { computeContentHash } from '../csv/csv-parser.service';
import type { IResolvedCsvRow } from '../csv/csv.types';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';

export interface IFabraryImportResult {
  /** ID of the newly created `csv_source` row. */
  readonly sourceId: string;
  /** Total card copies added to the user's library (sum of quantities). */
  readonly cardCount: number;
  /** Number of distinct card identifiers in the import. */
  readonly uniqueCardCount: number;
  /** Imported deck name — used by the UI as the source label confirmation. */
  readonly deckName: string;
  /** Fabrary deck format string (e.g. "blitz", "classic-constructed"). */
  readonly format: string;
}

/**
 * Imports a Fabrary deck **as a library Source**, not as a tracked deck.
 *
 * Reuses `FabraryService.fetchDeck` (the same call powering deck onboarding)
 * and persists the resulting card list as a `kind='csv'` row with the
 * Fabrary URL stamped on `sourceUrl` so the user can recognise the origin
 * later. We intentionally pick `kind='csv'` over a new `kind='fabrary'`
 * to avoid a schema migration — distinguishing the origin via the URL
 * column is enough for both UI and analytics needs today.
 *
 * The library import is additive only (no replace / merge flows): each
 * call creates a fresh source. Re-importing the same deck creates a
 * duplicate source the user can prune from `/library-csv-sources`.
 */
@Injectable()
export class FabraryImportService {
  private readonly logger = new Logger(FabraryImportService.name);

  constructor(
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    private readonly dataSource: DataSource,
    private readonly fabraryService: FabraryService,
    private readonly decisionsService: DecisionsService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  /** Public entry point for the controller. */
  async importFromUrl(userId: string, url: string): Promise<IFabraryImportResult> {
    let ulid: string;
    try {
      ulid = parseFabraryUrl(url);
    } catch (error) {
      // Re-pack as 400 — controller-level error filter only knows
      // FabraryImportError, but the existing UI consumes plain HTTP errors.
      const message =
        error instanceof FabraryImportError
          ? error.message
          : (error as Error).message;
      throw new BadRequestException(message);
    }

    let deck: IDeckImportDto;
    try {
      deck = await this.fabraryService.fetchDeck(ulid);
    } catch (error) {
      if (
        error instanceof FabraryImportError &&
        (error.code === EFabraryErrorCode.INVALID_PAYLOAD ||
          error.code === EFabraryErrorCode.INVALID_URL ||
          error.code === EFabraryErrorCode.INVALID_ULID)
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const resolved = aggregateAsResolvedRows(deck);
    if (resolved.length === 0) {
      throw new BadRequestException(
        'Fabrary deck has no importable cards — check that the URL points to a populated deck.',
      );
    }

    const totalCopies = resolved.reduce((sum, r) => sum + r.quantity, 0);
    const hash = computeContentHash(resolved);
    const label = `Fabrary: ${deck.name}`;

    const savedSource = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const source = manager.create(CsvSourceEntity, {
          userId,
          kind: 'csv',
          label,
          originalFilename: null,
          sourceUrl: url,
          contentHash: hash,
          cardCount: resolved.length,
          active: true,
        });
        const persisted = await manager.save(CsvSourceEntity, source);

        const cardEntities = resolved.map((row) =>
          manager.create(CollectionCardEntity, {
            userId,
            cardIdentifier: row.cardIdentifier,
            sourceId: persisted.id,
            quantity: row.quantity,
          }),
        );
        await manager.save(CollectionCardEntity, cardEntities);

        return persisted;
      },
    );

    this.logger.log({
      event: 'fabrary.library_import',
      userId,
      ulid,
      sourceId: savedSource.id,
      uniqueCardCount: resolved.length,
      totalCopies,
    });

    await this.recomputeReadinessForUser(userId);

    return {
      sourceId: savedSource.id,
      cardCount: totalCopies,
      uniqueCardCount: resolved.length,
      deckName: deck.name,
      format: deck.format,
    };
  }

  /**
   * Same recompute pattern as `SourcesService.recomputeReadinessForUser`.
   * Failures are logged and swallowed so a non-critical recompute never
   * fails the import response.
   */
  private async recomputeReadinessForUser(userId: string): Promise<void> {
    let decks: TrackedDeckEntity[];
    try {
      decks = await this.trackedDeckRepo.find({ where: { userId } });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to load decks for readiness recompute after Fabrary import',
        userId,
        error: (error as Error).message,
      });
      return;
    }

    for (const deck of decks) {
      try {
        const exclusions = await this.decisionsService.loadExclusions(deck.id);
        await this.substitutionService.computeAndStoreReadiness(
          deck.id,
          userId,
          exclusions,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to recompute readiness for deck after Fabrary import',
          userId,
          trackedDeckId: deck.id,
          error: (error as Error).message,
        });
      }
    }
  }
}

/**
 * Flattens the four Fabrary slot arrays (hero + mainboard + equipment +
 * weapons) into a single list keyed by cardIdentifier with summed
 * quantities. Hero is counted as quantity 1. Skips any zero-qty entries
 * defensively.
 *
 * Exported separately for direct unit testing; pure function with no DI.
 */
export function aggregateAsResolvedRows(
  deck: IDeckImportDto,
): readonly IResolvedCsvRow[] {
  const totals = new Map<string, number>();

  const heroId = deck.hero.cardIdentifier;
  if (heroId) totals.set(heroId, (totals.get(heroId) ?? 0) + 1);

  const cardLists: readonly (readonly IDeckCardEntry[])[] = [
    deck.mainboard,
    deck.equipment,
    deck.weapons,
  ];

  for (const list of cardLists) {
    for (const entry of list) {
      if (entry.quantity <= 0) continue;
      totals.set(
        entry.cardIdentifier,
        (totals.get(entry.cardIdentifier) ?? 0) + entry.quantity,
      );
    }
  }

  let rowNumber = 1;
  const resolved: IResolvedCsvRow[] = [];
  for (const [cardIdentifier, quantity] of totals) {
    resolved.push({ rowNumber: rowNumber++, cardIdentifier, quantity });
  }
  return resolved;
}
