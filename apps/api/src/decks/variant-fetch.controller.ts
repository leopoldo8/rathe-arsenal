import {
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { StoreEntity } from '../database/entities/store.entity';
import { IBreakdown } from './dtos/tracked-deck-detail.response.dto';
import { IFetchCard, VariantFetchService } from '../stores/variant-fetch.service';
import { IVariantFetchProgressDto } from '../stores/dtos/shopping-line.response.dto';

/** Throttle: 10 trigger requests per 10 minutes per IP. */
const TEN_MINUTES_MS = 10 * 60 * 1_000;

/** Default store slug for Phase 1b single-store iteration. */
const DEFAULT_STORE_SLUG = 'cupula-dt';

/**
 * Response when no cards are missing from the deck (Path A).
 */
export interface IVariantFetchNothingResponse {
  readonly status: 'nothing_to_fetch';
}

/**
 * Response when all cards already have fresh variant data.
 */
export interface IVariantFetchFreshResponse {
  readonly status: 'already_fresh';
}

/**
 * Response when a new fetch was started (202 Accepted).
 */
export interface IVariantFetchStartedResponse {
  readonly status: 'started';
  readonly fetchId: string;
  readonly total: number;
}

/**
 * Response when a fetch is already in progress for this deck (202 Accepted).
 */
export interface IVariantFetchInProgressResponse {
  readonly status: 'in_progress';
  readonly fetchId: string;
  readonly progress: IVariantFetchProgressDto;
}

export type TVariantFetchResponse =
  | IVariantFetchNothingResponse
  | IVariantFetchFreshResponse
  | IVariantFetchStartedResponse
  | IVariantFetchInProgressResponse;

/**
 * POST /decks/:deckId/fetch-variants
 *
 * Triggers an async detail-page fetch for the deck's missing cards.
 *
 * Authentication stack:
 *   1. Global ThrottlerGuard: rate-limits by IP.
 *   2. Global JwtAuthGuard: requires valid JWT.
 *   3. Method-level OwnsTrackedDeckGuard: verifies deck ownership.
 *
 * Response codes:
 *   200 — nothing_to_fetch (no missing cards) OR already_fresh
 *   202 — started (new fetch) OR in_progress (duplicate call)
 *   403 — user does not own the deck
 */
@Controller('decks/:deckId')
@Throttle({ default: { limit: 10, ttl: TEN_MINUTES_MS } })
export class VariantFetchController {
  constructor(
    private readonly variantFetchService: VariantFetchService,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    @InjectRepository(StoreStockEntity)
    private readonly storeStockRepo: Repository<StoreStockEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
  ) {}

  @Post('fetch-variants')
  @UseGuards(OwnsTrackedDeckGuard)
  async triggerVariantFetch(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TVariantFetchResponse> {
    void user; // ownership verified by OwnsTrackedDeckGuard

    const deckIdStr = String(deckId);

    // Step 1: load the latest snapshot to extract missing card identifiers.
    const latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    if (!latestSnapshot?.breakdown) {
      // No snapshot means no missing cards to fetch.
      res.status(HttpStatus.OK);
      return { status: 'nothing_to_fetch' };
    }

    const breakdown = latestSnapshot.breakdown as unknown as IBreakdown;
    const missing = breakdown.missing ?? [];

    if (missing.length === 0) {
      res.status(HttpStatus.OK);
      return { status: 'nothing_to_fetch' };
    }

    const cardIdentifiers = [...new Set(missing.map((m) => m.cardIdentifier))];

    // Step 2: check if a fetch is already in progress.
    const existingProgress = this.variantFetchService.getProgress(deckIdStr);
    if (existingProgress?.inProgress) {
      const progressDto: IVariantFetchProgressDto = {
        fetchId: existingProgress.fetchId,
        total: existingProgress.total,
        completed: existingProgress.completed,
        failed: existingProgress.failed,
        inProgress: existingProgress.inProgress,
        cards: Object.fromEntries(existingProgress.cards),
      };
      res.status(HttpStatus.ACCEPTED);
      return {
        status: 'in_progress',
        fetchId: existingProgress.fetchId,
        progress: progressDto,
      };
    }

    // Step 3: load store entity (single-store Phase 1b).
    const store = await this.storeRepo.findOne({
      where: { slug: DEFAULT_STORE_SLUG, active: true },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Step 4: check freshness before spawning a new loop.
    const freshCheck = await this.variantFetchService.isFreshForDeck(
      store.id,
      deckIdStr,
      cardIdentifiers,
    );

    if (freshCheck.fresh) {
      res.status(HttpStatus.OK);
      return { status: 'already_fresh' };
    }

    // Step 5: load store_stock rows to build IFetchCard list.
    const stockRows = await this.storeStockRepo.find({
      where: {
        storeId: store.id,
        cardIdentifier: In(cardIdentifiers),
      },
    });

    const stockByIdentifier = new Map<string, StoreStockEntity>();
    for (const row of stockRows) {
      stockByIdentifier.set(row.cardIdentifier, row);
    }

    // Build IFetchCard for every card that has a productUrl in stock.
    // Cards without a stock row are skipped (no URL to fetch).
    const fetchCards: IFetchCard[] = cardIdentifiers
      .map((id): IFetchCard | null => {
        const row = stockByIdentifier.get(id);
        if (!row?.productUrl) {
          return null;
        }
        return {
          cardIdentifier: id,
          productUrl: row.productUrl,
          listingPriceCents: row.priceCents,
          listingQuantity: row.quantity,
        };
      })
      .filter((c): c is IFetchCard => c !== null);

    if (fetchCards.length === 0) {
      // All missing cards lack a product URL — treat as nothing to fetch.
      res.status(HttpStatus.OK);
      return { status: 'nothing_to_fetch' };
    }

    // Step 6: start the fetch.
    // VariantFetchService.startFetch() is synchronous (returns fetchId immediately)
    // and internally attaches a .catch() to the async orchestration loop.
    // Belt-and-suspenders: the returned fetchId confirms the loop was started.
    const fetchId = this.variantFetchService.startFetch(
      deckIdStr,
      store.id,
      fetchCards,
    );

    res.status(HttpStatus.ACCEPTED);
    return {
      status: 'started',
      fetchId,
      total: fetchCards.length,
    };
  }
}

