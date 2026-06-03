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
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { StoreEntity } from '../database/entities/store.entity';
import { IBreakdown } from './dtos/tracked-deck-detail.response.dto';
import { VariantFetchService } from '../stores/variant-fetch.service';
import { VariantFetchQueueService } from '../stores/variant-fetch-queue.service';
import { ResolveJobCardsService } from '../stores/resolve-job-cards.service';

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
 * Response when a new fetch job was enqueued (202 Accepted).
 */
export interface IVariantFetchStartedResponse {
  readonly status: 'started';
  readonly jobId: string;
  readonly jobStatus: string;
}

export type TVariantFetchResponse =
  | IVariantFetchNothingResponse
  | IVariantFetchFreshResponse
  | IVariantFetchStartedResponse;

/**
 * POST /decks/:deckId/fetch-variants
 *
 * Enqueues a variant-fetch job for the deck's missing cards.
 *
 * Authentication stack:
 *   1. Global ThrottlerGuard: rate-limits by IP.
 *   2. Global JwtAuthGuard: requires valid JWT.
 *   3. Method-level OwnsTrackedDeckGuard: verifies deck ownership.
 *
 * Response codes:
 *   200 — nothing_to_fetch (no missing cards) OR already_fresh
 *   202 — started (job enqueued; idempotent — returns the existing job if one is pending/running)
 *   403 — user does not own the deck
 */
@Controller('decks/:deckId')
@Throttle({ default: { limit: 10, ttl: TEN_MINUTES_MS } })
export class VariantFetchController {
  constructor(
    private readonly variantFetchService: VariantFetchService,
    private readonly queue: VariantFetchQueueService,
    private readonly resolveJobCards: ResolveJobCardsService,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
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
    const deckIdStr = String(deckId);
    const userId = user.userId;

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

    // Step 2: load store entity (single-store Phase 1b).
    const store = await this.storeRepo.findOne({
      where: { slug: DEFAULT_STORE_SLUG, active: true },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Step 3: check freshness before spawning a new job.
    const freshCheck = await this.variantFetchService.isFreshForDeck(
      store.id,
      deckIdStr,
      cardIdentifiers,
    );

    if (freshCheck.fresh) {
      res.status(HttpStatus.OK);
      return { status: 'already_fresh' };
    }

    // Step 4: resolve store_stock rows to IFetchCard (shared service).
    const fetchCards = await this.resolveJobCards.resolve(store.id, cardIdentifiers);

    if (fetchCards.length === 0) {
      // All missing cards lack a product URL — treat as nothing to fetch.
      res.status(HttpStatus.OK);
      return { status: 'nothing_to_fetch' };
    }

    // Step 5: enqueue the job (idempotent — returns existing pending/running job if any).
    const job = await this.queue.enqueue(userId, deckId, store.id, fetchCards);

    res.status(HttpStatus.ACCEPTED);
    return {
      status: 'started',
      jobId: job.id,
      jobStatus: job.status,
    };
  }
}
