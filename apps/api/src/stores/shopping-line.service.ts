import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { IBreakdown, IBreakdownEntry } from '../decks/dtos/tracked-deck-detail.response.dto';
import {
  EVariantVerificationStatus,
  IShoppingLine,
  IShoppingLineAggregate,
  IShoppingLinePopulated,
  IShoppingLineResponse,
  IShoppingLineUpgradeCandidate,
  IShoppingLineVariant,
} from './dtos/shopping-line.response.dto';

/**
 * Default store slug for Phase 1b. Single-store iteration; the parameter
 * is exposed so Phase 2 can pass a different slug without changing this file.
 */
const DEFAULT_STORE_SLUG = 'cupula-dt';

/**
 * Computes the shopping line for a deck's missing-cards breakdown by joining
 * against live store_stock data. Read-only; nothing is persisted here.
 *
 * S10 belt-and-suspenders: every productUrl is re-validated at read time
 * (hostname must match store.baseUrl) even though the scraper enforces this
 * at write time. Rows that fail are blanked with a warning log.
 */
@Injectable()
export class ShoppingLineService {
  private readonly logger = new Logger(ShoppingLineService.name);

  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreStockEntity)
    private readonly storeStockRepo: Repository<StoreStockEntity>,
    @InjectRepository(StoreStockVariantEntity)
    private readonly storeStockVariantRepo: Repository<StoreStockVariantEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
  ) {}

  /**
   * Computes the shopping line for a single deck breakdown.
   *
   * @param breakdown - Primary breakdown from the snapshot.
   * @param rawBreakdown - Optional raw breakdown (before substitution) used to
   *   derive upgrade candidates for Path B. Pass the same breakdown as
   *   `breakdown` when there is no raw data.
   * @param storeSlug - Override for tests / Phase 2 multi-store. Defaults to
   *   'cupula-dt'.
   *
   * @returns null when missing.length === 0 (Path A — nothing to buy).
   */
  async computeForBreakdown(
    breakdown: IBreakdown,
    rawBreakdown?: IBreakdown,
    storeSlug: string = DEFAULT_STORE_SLUG,
  ): Promise<IShoppingLineResponse | null> {
    const missingEntries = breakdown.missing;

    if (missingEntries.length === 0) {
      return null;
    }

    try {
      const store = await this.storeRepo.findOne({
        where: { slug: storeSlug, active: true },
      });

      if (!store) {
        return { kind: 'error', reason: 'store_missing' };
      }

      const storeHostname = this.extractHostname(store.baseUrl);
      if (!storeHostname) {
        this.logger.warn({
          msg: 'Store has invalid baseUrl — cannot derive hostname',
          storeSlug,
          baseUrl: store.baseUrl,
        });
        return { kind: 'error', reason: 'store_invalid_base_url' };
      }

      const needed = this.buildNeededMap(missingEntries);
      const cardIdentifiers = [...needed.keys()];

      const stockRows = await this.storeStockRepo.find({
        where: {
          storeId: store.id,
          cardIdentifier: In(cardIdentifiers),
        },
      });

      if (stockRows.length === 0) {
        // Check whether the store has ANY stock rows at all.
        const anyStock = await this.storeStockRepo.count({
          where: { storeId: store.id },
        });
        if (anyStock === 0) {
          return { kind: 'unscraped' };
        }
      }

      const stockByIdentifier = new Map<string, StoreStockEntity>();
      for (const row of stockRows) {
        stockByIdentifier.set(row.cardIdentifier, row);
      }

      // Load variant rows for the same (storeId, cardIdentifiers) set.
      const variantRows = await this.storeStockVariantRepo.find({
        where: {
          storeId: store.id,
          cardIdentifier: In(cardIdentifiers),
        },
      });

      // Group variant rows by cardIdentifier for O(1) lookup.
      // Use push-based accumulation to avoid O(n²) intermediate array allocations
      // from spread operator on each iteration.
      const variantsByIdentifier = new Map<string, StoreStockVariantEntity[]>();
      for (const row of variantRows) {
        const bucket = variantsByIdentifier.get(row.cardIdentifier);
        if (bucket) {
          bucket.push(row);
        } else {
          variantsByIdentifier.set(row.cardIdentifier, [row]);
        }
      }

      const lines = this.buildLines(
        missingEntries,
        needed,
        stockByIdentifier,
        variantsByIdentifier,
        storeHostname,
      );

      const upgradeCandidates = this.buildUpgradeCandidates(
        breakdown,
        rawBreakdown,
        needed,
        stockByIdentifier,
        storeHostname,
      );

      const sortedLines = this.sortLines(lines);

      // totalCostCents sums lineCostCents from each line (not unitPriceCents × qty).
      const totalCostCents = sortedLines.reduce(
        (sum, line) => sum + line.lineCostCents,
        0,
      );

      const availableCardCount = sortedLines.filter(
        (l) => l.quantityAvailable > 0,
      ).length;
      const unavailableCardCount = sortedLines.filter(
        (l) => l.quantityAvailable === 0,
      ).length;

      const allTimestamps = sortedLines
        .filter((l) => l.quantityAvailable > 0)
        .map((l) => l.lastFetchedAt);

      const lastFetchedAt =
        allTimestamps.length > 0
          ? allTimestamps.reduce((oldest, ts) => (ts < oldest ? ts : oldest))
          : new Date(0).toISOString();

      // isEstimated = true when ANY line lacks fresh variant data.
      const isEstimated = sortedLines.some((l) => !l.hasVariantData);

      const result: IShoppingLinePopulated = {
        kind: 'populated',
        storeName: store.name,
        storeSlug: store.slug,
        storeHostname,
        totalCostCents,
        availableCardCount,
        unavailableCardCount,
        lastFetchedAt,
        lines: sortedLines,
        upgradeCandidates,
        isEstimated,
      };

      return result;
    } catch (error) {
      this.logger.error({
        msg: 'Shopping line computation failed',
        storeSlug,
        error: (error as Error).message,
      });
      return { kind: 'error', reason: 'db_error' };
    }
  }

  /**
   * Computes an aggregate shopping line across all tracked decks for a user.
   *
   * Uses a single batched query against store_stock rather than N per-deck
   * queries — O(1) DB round-trips regardless of tracked deck count.
   *
   * @returns null when no tracked decks have missing cards, or when the store
   *   is inactive / missing, or when stock is unscraped.
   */
  async computeAggregate(
    userId: string,
    storeSlug: string = DEFAULT_STORE_SLUG,
  ): Promise<IShoppingLineAggregate | null> {
    try {
      const store = await this.storeRepo.findOne({
        where: { slug: storeSlug, active: true },
      });

      if (!store) {
        return null;
      }

      const decks = await this.trackedDeckRepo.find({
        where: { userId },
      });

      if (decks.length === 0) {
        return null;
      }

      const deckIds = decks.map((d) => d.id);

      // One subquery per deck to get the latest snapshot id.
      const latestSnapshots = await this.snapshotRepo
        .createQueryBuilder('snap')
        .where('snap.trackedDeckId IN (:...deckIds)', { deckIds })
        .andWhere(
          'snap.id = (' +
            'SELECT s2.id FROM deck_readiness_snapshot s2 ' +
            'WHERE s2."trackedDeckId" = snap."trackedDeckId" ' +
            'ORDER BY s2."computedAt" DESC LIMIT 1' +
            ')',
        )
        .getMany();

      if (latestSnapshots.length === 0) {
        return null;
      }

      // Collect all missing cardIdentifiers across all decks.
      type TDeckMissing = {
        deckId: number;
        totalCards: number;
        missing: ReadonlyArray<{ cardIdentifier: string; quantity: number }>;
        effectivePercent: number;
      };

      const deckMissingList: TDeckMissing[] = [];
      const allMissingIdentifiers = new Set<string>();

      for (const snap of latestSnapshots) {
        const breakdown = snap.breakdown as unknown as IBreakdown;
        if (!breakdown?.missing?.length) {
          continue;
        }

        const missing = breakdown.missing;
        for (const entry of missing) {
          allMissingIdentifiers.add(entry.cardIdentifier);
        }

        deckMissingList.push({
          deckId: snap.trackedDeckId,
          // effectivePercent needed to determine completability.
          totalCards: breakdown.exact.length + breakdown.substituted.length + breakdown.missing.length,
          missing,
          effectivePercent: snap.effectivePercent,
        });
      }

      if (deckMissingList.length === 0) {
        return null;
      }

      const uniqueCardsMissing = allMissingIdentifiers.size;

      // Check if the store has ANY stock rows at all. If not, return unscraped
      // so the frontend render guard (agg.kind === 'unscraped') fires correctly.
      const anyStock = await this.storeStockRepo.count({
        where: { storeId: store.id },
      });
      if (anyStock === 0) {
        return {
          storeName: store.name,
          storeSlug: store.slug,
          totalCostCents: 0,
          completableDecks: 0,
          totalDecks: deckMissingList.length,
          kind: 'unscraped',
          uniqueCardsMissing,
        };
      }

      // Single batched query for all missing cards across all decks.
      const stockRows = await this.storeStockRepo.find({
        where: {
          storeId: store.id,
          cardIdentifier: In([...allMissingIdentifiers]),
        },
      });

      const stockByIdentifier = new Map<string, StoreStockEntity>();
      for (const row of stockRows) {
        // Only count rows with actual stock and price.
        if (row.quantity > 0 && row.priceCents !== null) {
          stockByIdentifier.set(row.cardIdentifier, row);
        }
      }

      let totalCostCents = 0;
      let completableDecks = 0;

      for (const deckMissing of deckMissingList) {
        let deckCost = 0;
        let allMissingCovered = true;

        for (const entry of deckMissing.missing) {
          const stock = stockByIdentifier.get(entry.cardIdentifier);
          if (stock) {
            const qty = Math.min(entry.quantity, stock.quantity);
            deckCost += qty * (stock.priceCents as number);
          } else {
            allMissingCovered = false;
          }
        }

        totalCostCents += deckCost;
        if (allMissingCovered) {
          completableDecks += 1;
        }
      }

      return {
        storeName: store.name,
        storeSlug: store.slug,
        totalCostCents,
        completableDecks,
        totalDecks: deckMissingList.length,
        kind: 'populated',
        uniqueCardsMissing,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Aggregate shopping line computation failed',
        userId,
        storeSlug,
        error: (error as Error).message,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildNeededMap(
    entries: readonly IBreakdownEntry[],
  ): Map<string, number> {
    const needed = new Map<string, number>();
    for (const entry of entries) {
      const existing = needed.get(entry.cardIdentifier) ?? 0;
      needed.set(entry.cardIdentifier, existing + entry.quantity);
    }
    return needed;
  }

  private buildLines(
    missingEntries: readonly IBreakdownEntry[],
    needed: Map<string, number>,
    stockByIdentifier: Map<string, StoreStockEntity>,
    variantsByIdentifier: Map<string, StoreStockVariantEntity[]>,
    storeHostname: string,
  ): IShoppingLine[] {
    // De-duplicate by cardIdentifier in case breakdown has duplicates.
    const seen = new Set<string>();
    const lines: IShoppingLine[] = [];

    for (const entry of missingEntries) {
      if (seen.has(entry.cardIdentifier)) {
        continue;
      }
      seen.add(entry.cardIdentifier);

      const quantityNeeded = needed.get(entry.cardIdentifier) ?? entry.quantity;
      const stock = stockByIdentifier.get(entry.cardIdentifier);
      const variants = variantsByIdentifier.get(entry.cardIdentifier) ?? [];

      lines.push(
        this.buildLine(
          entry.cardIdentifier,
          quantityNeeded,
          stock,
          variants,
          storeHostname,
        ),
      );
    }

    return lines;
  }

  private buildLine(
    cardIdentifier: string,
    quantityNeeded: number,
    stock: StoreStockEntity | undefined,
    variantRows: StoreStockVariantEntity[],
    storeHostname: string,
  ): IShoppingLine {
    const catalogCard = this.safeGetCard(cardIdentifier);
    const lastFetchedAt =
      stock?.lastFetchedAt.toISOString() ?? new Date(0).toISOString();
    const productUrl = stock
      ? this.validateProductUrl(stock.productUrl, storeHostname, cardIdentifier)
      : '';

    // Determine whether variant data is fresh and usable.
    const freshVariants = this.getFreshVariants(variantRows, stock);

    if (freshVariants !== null) {
      // Use variant data path.
      return this.buildVariantLine(
        cardIdentifier,
        quantityNeeded,
        freshVariants,
        catalogCard,
        productUrl,
        lastFetchedAt,
      );
    }

    // Fallback to listing data.
    if (!stock || stock.quantity === 0 || stock.priceCents === null) {
      return {
        cardIdentifier,
        cardName: catalogCard?.name ?? cardIdentifier,
        pitch: catalogCard?.pitch ?? null,
        quantityNeeded,
        quantityAvailable: 0,
        unitPriceCents: stock?.priceCents ?? null,
        productUrl: '',
        lastFetchedAt,
        hasVariantData: false,
        dataSource: 'listing',
        lineCostCents: 0,
      };
    }

    const quantityAvailable = Math.min(quantityNeeded, stock.quantity);

    return {
      cardIdentifier,
      cardName: catalogCard?.name ?? cardIdentifier,
      pitch: catalogCard?.pitch ?? null,
      quantityNeeded,
      quantityAvailable,
      unitPriceCents: stock.priceCents,
      productUrl,
      lastFetchedAt,
      hasVariantData: false,
      dataSource: 'listing',
      lineCostCents: quantityAvailable * stock.priceCents,
    };
  }

  /**
   * Returns fresh variant rows when variant data exists AND passes the
   * content-based staleness check against the current listing row.
   *
   * Returns null when:
   * - No variant rows exist for this card.
   * - All variant rows have null priceCents (unusable data).
   * - Listing row is missing (no staleness comparison possible).
   * - Snapshot values do not match current listing values (stale).
   */
  private getFreshVariants(
    variantRows: StoreStockVariantEntity[],
    stock: StoreStockEntity | undefined,
  ): StoreStockVariantEntity[] | null {
    if (variantRows.length === 0) {
      return null;
    }

    // All variant priceCents must be non-null to use variant data.
    const allHavePrice = variantRows.every((v) => v.priceCents !== null);
    if (!allHavePrice) {
      return null;
    }

    if (!stock) {
      return null;
    }

    // Staleness check: strict equality on both snapshot columns.
    // Use the snapshot from the first variant row (all rows for the same
    // card were written in the same detail fetch and share the same snapshot).
    const firstRow = variantRows[0]!;
    const snapshotPriceCents = firstRow.listingPriceCentsSnapshot;
    const snapshotQuantity = firstRow.listingQuantitySnapshot;

    if (
      snapshotPriceCents !== stock.priceCents ||
      snapshotQuantity !== stock.quantity
    ) {
      return null;
    }

    return variantRows;
  }

  /**
   * Builds a shopping line using variant-level data with greedy cheapest-first
   * allocation.
   *
   * Sort variants by priceCents ascending. Fill quantityNeeded from cheapest
   * first; spill to next when cheapest is exhausted. lineCostCents is the
   * sum of (allocated × price) across all tiers.
   */
  private buildVariantLine(
    cardIdentifier: string,
    quantityNeeded: number,
    variantRows: StoreStockVariantEntity[],
    catalogCard: { name: string; pitch: number | null } | null,
    productUrl: string,
    lastFetchedAt: string,
  ): IShoppingLine {
    // Sort ascending by priceCents (cheapest first).
    const sorted = [...variantRows].sort((a, b) => a.priceCents - b.priceCents);

    const totalVariantQuantity = sorted.reduce((sum, v) => sum + v.quantity, 0);

    // R12b: variant rows exist but all quantities are zero.
    if (totalVariantQuantity === 0) {
      const variants: IShoppingLineVariant[] = sorted.map((v) => ({
        edition: v.edition,
        condition: v.condition,
        finish: v.finish,
        priceCents: v.priceCents,
        quantity: v.quantity,
      }));

      return {
        cardIdentifier,
        cardName: catalogCard?.name ?? cardIdentifier,
        pitch: catalogCard?.pitch ?? null,
        quantityNeeded,
        quantityAvailable: 0,
        unitPriceCents: sorted[0]!.priceCents,
        productUrl,
        lastFetchedAt,
        hasVariantData: true,
        dataSource: 'variant',
        lineCostCents: 0,
        variants,
        verificationStatus: EVariantVerificationStatus.VERIFIED_ZERO,
      };
    }

    // Greedy cheapest-first allocation.
    let remaining = quantityNeeded;
    let lineCostCents = 0;
    let quantityAvailable = 0;

    for (const variant of sorted) {
      if (remaining <= 0) {
        break;
      }
      const allocated = Math.min(remaining, variant.quantity);
      lineCostCents += allocated * variant.priceCents;
      quantityAvailable += allocated;
      remaining -= allocated;
    }

    // unitPriceCents = cheapest available variant price (display only).
    const cheapestPrice = sorted.find((v) => v.quantity > 0)?.priceCents ?? sorted[0]!.priceCents;

    const variants: IShoppingLineVariant[] = sorted.map((v) => ({
      edition: v.edition,
      condition: v.condition,
      finish: v.finish,
      priceCents: v.priceCents,
      quantity: v.quantity,
    }));

    return {
      cardIdentifier,
      cardName: catalogCard?.name ?? cardIdentifier,
      pitch: catalogCard?.pitch ?? null,
      quantityNeeded,
      quantityAvailable,
      unitPriceCents: cheapestPrice,
      productUrl,
      lastFetchedAt,
      hasVariantData: true,
      dataSource: 'variant',
      lineCostCents,
      variants,
    };
  }

  private buildUpgradeCandidates(
    breakdown: IBreakdown,
    rawBreakdown: IBreakdown | undefined,
    _needed: Map<string, number>,
    stockByIdentifier: Map<string, StoreStockEntity>,
    storeHostname: string,
  ): IShoppingLineUpgradeCandidate[] {
    if (!rawBreakdown) {
      return [];
    }

    // Upgrade candidates = raw missing - primary missing (i.e. substituted card originals).
    const primaryMissingIds = new Set(
      breakdown.missing.map((e) => e.cardIdentifier),
    );

    const candidates: IShoppingLineUpgradeCandidate[] = [];
    const seen = new Set<string>();

    for (const entry of rawBreakdown.missing) {
      if (seen.has(entry.cardIdentifier)) {
        continue;
      }
      if (primaryMissingIds.has(entry.cardIdentifier)) {
        // Already in the primary section.
        continue;
      }
      seen.add(entry.cardIdentifier);

      const stock = stockByIdentifier.get(entry.cardIdentifier);
      const catalogCard = this.safeGetCard(entry.cardIdentifier);

      if (!stock || stock.quantity === 0 || stock.priceCents === null) {
        candidates.push({
          cardIdentifier: entry.cardIdentifier,
          cardName: catalogCard?.name ?? entry.cardIdentifier,
          pitch: catalogCard?.pitch ?? null,
          quantityNeeded: entry.quantity,
          quantityAvailable: 0,
          unitPriceCents: stock?.priceCents ?? null,
          productUrl: '',
          lastFetchedAt: stock?.lastFetchedAt.toISOString() ?? new Date(0).toISOString(),
        });
        continue;
      }

      const quantityAvailable = Math.min(entry.quantity, stock.quantity);
      const productUrl = this.validateProductUrl(
        stock.productUrl,
        storeHostname,
        entry.cardIdentifier,
      );

      candidates.push({
        cardIdentifier: entry.cardIdentifier,
        cardName: catalogCard?.name ?? entry.cardIdentifier,
        pitch: catalogCard?.pitch ?? null,
        quantityNeeded: entry.quantity,
        quantityAvailable,
        unitPriceCents: stock.priceCents,
        productUrl,
        lastFetchedAt: stock.lastFetchedAt.toISOString(),
      });
    }

    return candidates;
  }

  private sortLines(lines: IShoppingLine[]): IShoppingLine[] {
    return [...lines].sort((a, b) => {
      // Available lines first.
      const aAvailable = a.quantityAvailable > 0 ? 0 : 1;
      const bAvailable = b.quantityAvailable > 0 ? 0 : 1;
      if (aAvailable !== bAvailable) return aAvailable - bAvailable;

      // Then by price ascending (null price sorts last).
      if (a.unitPriceCents !== null && b.unitPriceCents !== null) {
        if (a.unitPriceCents !== b.unitPriceCents) {
          return a.unitPriceCents - b.unitPriceCents;
        }
      } else if (a.unitPriceCents === null && b.unitPriceCents !== null) {
        return 1;
      } else if (a.unitPriceCents !== null && b.unitPriceCents === null) {
        return -1;
      }

      // Deterministic tie-break by card name.
      return a.cardName.localeCompare(b.cardName);
    });
  }

  /**
   * S10 read-time allow-list pre-check.
   * Returns the original URL if valid, or '' if it fails the hostname check.
   */
  private validateProductUrl(
    productUrl: string,
    storeHostname: string,
    cardIdentifier: string,
  ): string {
    try {
      const parsed = new URL(productUrl);
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== storeHostname
      ) {
        this.logger.warn({
          msg: 'S10: productUrl failed read-time hostname check — blanking',
          cardIdentifier,
          productUrl,
          expected: storeHostname,
          got: parsed.hostname,
        });
        return '';
      }
      return productUrl;
    } catch {
      this.logger.warn({
        msg: 'S10: productUrl is not a valid URL — blanking',
        cardIdentifier,
        productUrl,
      });
      return '';
    }
  }

  /**
   * Extracts the hostname from a store's baseUrl.
   * Returns null if the URL is invalid.
   */
  private extractHostname(baseUrl: string): string | null {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return null;
    }
  }

  /**
   * Safely retrieves a card from the catalog. Returns null when the identifier
   * is not found (can happen for old/test identifiers).
   */
  private safeGetCard(
    cardIdentifier: string,
  ): { name: string; pitch: number | null } | null {
    try {
      const card = catalog.getCard(cardIdentifier);
      return { name: card.name, pitch: card.pitch };
    } catch {
      this.logger.warn({
        msg: 'Card not found in catalog — using identifier as name',
        cardIdentifier,
      });
      return null;
    }
  }
}
