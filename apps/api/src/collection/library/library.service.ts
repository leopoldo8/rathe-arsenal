import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { catalog, getSetName } from '@rathe-arsenal/engine';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionReadService } from '../collection-read.service';
import {
  ILibraryCard,
  ILibraryCardContribution,
  ILibraryResponse,
  ILibraryStats,
  IPitchBreakdown,
} from './dtos/library-response.dto';

/**
 * Pitch value → bucket mapping.
 * - 1 = red, 2 = yellow, 3 = blue, null/undefined = colorless.
 */
type TPitchBucket = 'red' | 'yellow' | 'blue' | 'colorless';

function pitchBucket(pitch: number | null): TPitchBucket {
  if (pitch === 1) return 'red';
  if (pitch === 2) return 'yellow';
  if (pitch === 3) return 'blue';
  return 'colorless';
}

/**
 * Computes a user's full library view — per-card owned quantities decorated
 * with catalog metadata, plus aggregate stats and estimated market value.
 *
 * Price aggregation queries store_stock directly in a single batched query
 * (MIN(priceCents) per cardIdentifier + MAX(lastFetchedAt) scalar).
 * No N+1 queries.
 */
@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly collectionReadService: CollectionReadService,
    @InjectRepository(StoreStockEntity)
    private readonly storeStockRepo: Repository<StoreStockEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
  ) {}

  async load(userId: string): Promise<ILibraryResponse> {
    // Step 1: Load owned quantities from all active sources.
    const ownedMap = await this.collectionReadService.loadOwned(userId);

    if (ownedMap.size === 0) {
      const emptyStats = await this.buildEmptyStats();
      return { cards: [], stats: emptyStats, setNames: {} };
    }

    const identifiers = [...ownedMap.keys()];

    // Step 1b: Per-card contribution breakdown — drives the hover stepper
    // on /library and disambiguates which source to decrement when a card
    // is split across two or more.
    const contributionsByCard = await this.loadContributionsByCard(userId);

    // Step 2: Batch price query — MIN(priceCents) per cardIdentifier.
    // Only rows with quantity > 0 and priceCents non-null contribute.
    const priceRows = await this.storeStockRepo
      .createQueryBuilder('ss')
      .select('ss.cardIdentifier', 'cardIdentifier')
      .addSelect('MIN(ss.priceCents)', 'minPriceCents')
      .where('ss.cardIdentifier IN (:...identifiers)', { identifiers })
      .andWhere('ss.quantity > 0')
      .andWhere('ss.priceCents IS NOT NULL')
      .groupBy('ss.cardIdentifier')
      .getRawMany<{ cardIdentifier: string; minPriceCents: string | null }>();

    // Step 3: Scalar MAX(lastFetchedAt) across all store_stock rows.
    const lastUpdatedResult = await this.storeStockRepo
      .createQueryBuilder('ss')
      .select('MAX(ss.lastFetchedAt)', 'maxLastFetchedAt')
      .getRawOne<{ maxLastFetchedAt: string | null }>();

    const priceByIdentifier = new Map<string, number>();
    for (const row of priceRows) {
      if (row.minPriceCents !== null) {
        priceByIdentifier.set(row.cardIdentifier, parseInt(row.minPriceCents, 10));
      }
    }

    const priceDataLastUpdatedAt = lastUpdatedResult?.maxLastFetchedAt
      ? new Date(lastUpdatedResult.maxLastFetchedAt).toISOString()
      : null;

    // Step 4: Decorate each identifier with catalog metadata.
    const cards: ILibraryCard[] = [];
    const pitchCounts: Record<TPitchBucket, number> = {
      red: 0,
      yellow: 0,
      blue: 0,
      colorless: 0,
    };
    let estimatedValueCents = 0;
    let pricedIdentifierCount = 0;

    for (const [cardIdentifier, ownedQuantity] of ownedMap) {
      let catalogCard: ReturnType<typeof catalog.getCard> | null = null;
      try {
        catalogCard = catalog.getCard(cardIdentifier);
      } catch {
        this.logger.warn({
          msg: 'Card in collection has no catalog match — skipping',
          cardIdentifier,
        });
        continue;
      }

      const bucket = pitchBucket(catalogCard.pitch);
      pitchCounts[bucket] += ownedQuantity;

      const minPriceCents = priceByIdentifier.get(cardIdentifier);
      if (minPriceCents !== undefined) {
        estimatedValueCents += ownedQuantity * minPriceCents;
        pricedIdentifierCount += 1;
      }

      cards.push({
        cardIdentifier,
        name: catalogCard.name,
        pitch: catalogCard.pitch,
        types: catalogCard.types,
        subtypes: catalogCard.subtypes,
        classes: catalogCard.classes,
        talents: catalogCard.talents,
        sets: catalogCard.sets,
        imageUrl: catalogCard.imageUrl,
        ownedQuantity,
        contributions: contributionsByCard.get(cardIdentifier) ?? [],
      });
    }

    const pitchBreakdown: IPitchBreakdown = {
      red: pitchCounts.red,
      yellow: pitchCounts.yellow,
      blue: pitchCounts.blue,
      colorless: pitchCounts.colorless,
    };

    const stats: ILibraryStats = {
      uniqueCount: cards.length,
      totalCopies: cards.reduce((sum, c) => sum + c.ownedQuantity, 0),
      pitchBreakdown,
      estimatedValueCents,
      pricedIdentifierCount,
      priceDataLastUpdatedAt,
    };

    const setNames = this.buildSetNamesMap(cards);

    return { cards, stats, setNames };
  }

  /**
   * Builds a `code → release name` map containing only set codes that appear
   * in the response's cards (avoids shipping the full 109-entry catalog
   * mapping when most users only own a few editions).
   */
  private buildSetNamesMap(
    cards: readonly ILibraryCard[],
  ): Readonly<Record<string, string>> {
    const codes = new Set<string>();
    for (const card of cards) {
      for (const code of card.sets) {
        codes.add(code);
      }
    }
    const map: Record<string, string> = {};
    for (const code of codes) {
      const name = getSetName(code);
      if (name !== null) map[code] = name;
    }
    return map;
  }

  /**
   * Builds a `cardIdentifier → contributions[]` map summarising which active
   * sources contribute to each card. Contributions sum to `ownedQuantity`,
   * so the web hover stepper can disambiguate a `−` click when more than
   * one source feeds the same card.
   *
   * Inactive sources are excluded — toggling a source off in
   * /library-csv-sources is a separate affordance and an inactive row
   * shouldn't appear in the stepper popover.
   */
  private async loadContributionsByCard(
    userId: string,
  ): Promise<Map<string, ILibraryCardContribution[]>> {
    const result = new Map<string, ILibraryCardContribution[]>();

    const activeSources = await this.csvSourceRepo.find({
      where: { userId, active: true },
      select: ['id', 'label', 'kind'],
    });
    if (activeSources.length === 0) return result;

    const activeSourceIds = activeSources.map((s) => s.id);
    const sourceMetaById = new Map(
      activeSources.map((s) => [
        s.id,
        { label: s.label ?? '', kind: s.kind } as const,
      ]),
    );

    const rows = await this.collectionCardRepo.find({
      where: { userId, sourceId: In(activeSourceIds) },
      select: ['cardIdentifier', 'sourceId', 'quantity'],
    });

    for (const row of rows) {
      if (row.quantity <= 0) continue;
      const meta = sourceMetaById.get(row.sourceId);
      if (!meta) continue;
      const list = result.get(row.cardIdentifier);
      const entry: ILibraryCardContribution = {
        sourceId: row.sourceId,
        sourceLabel:
          meta.kind === 'manual' ? 'Manual entries' : meta.label || 'Untitled source',
        kind: meta.kind,
        quantity: row.quantity,
      };
      if (list) {
        list.push(entry);
      } else {
        result.set(row.cardIdentifier, [entry]);
      }
    }

    // Stable order: manual entries first, then csv sources alphabetical.
    // The popover reads this directly so a deterministic order keeps the
    // UI predictable.
    for (const list of result.values()) {
      list.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'manual' ? -1 : 1;
        return a.sourceLabel.localeCompare(b.sourceLabel);
      });
    }

    return result;
  }

  /**
   * Builds stats for the empty-collection case. Still queries store_stock
   * for the freshness indicator — a user with zero cards should still see
   * whether price data has been scraped.
   */
  private async buildEmptyStats(): Promise<ILibraryStats> {
    const lastUpdatedResult = await this.storeStockRepo
      .createQueryBuilder('ss')
      .select('MAX(ss.lastFetchedAt)', 'maxLastFetchedAt')
      .getRawOne<{ maxLastFetchedAt: string | null }>();

    const priceDataLastUpdatedAt = lastUpdatedResult?.maxLastFetchedAt
      ? new Date(lastUpdatedResult.maxLastFetchedAt).toISOString()
      : null;

    return {
      uniqueCount: 0,
      totalCopies: 0,
      pitchBreakdown: { red: 0, yellow: 0, blue: 0, colorless: 0 },
      estimatedValueCents: 0,
      pricedIdentifierCount: 0,
      priceDataLastUpdatedAt,
    };
  }
}
