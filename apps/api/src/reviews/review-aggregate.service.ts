import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewAggregateEntity } from '../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';

// ---------------------------------------------------------------------------
// Internal types mirroring the engine's IReadinessBreakdown shape.
// We do not import the engine here to avoid a cross-layer dependency in the
// service; the JSONB breakdown is treated as an opaque structure and only the
// fields we need are accessed defensively.
// ---------------------------------------------------------------------------

interface IBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: unknown;
}

interface IBreakdown {
  readonly exact?: readonly IBreakdownEntry[];
  readonly substituted?: readonly ISubstitutedEntry[];
  readonly missing?: readonly IBreakdownEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the verdict + bracket from the snapshot's breakdown JSONB.
 *
 * Path classification mirrors the engine's `computePath`:
 *   - missing.length > 0  → Path C → 'not_ready'
 *   - substituted.length > 0 → Path B → 'close'
 *   - otherwise           → Path A → 'ready_to_play'
 */
function deriveVerdictAndBracket(breakdown: IBreakdown): {
  verdict: 'ready_to_play' | 'close' | 'not_ready';
  bracket: 'A' | 'B' | 'C';
} {
  const missing = breakdown.missing ?? [];
  const substituted = breakdown.substituted ?? [];

  if (missing.length > 0) {
    return { verdict: 'not_ready', bracket: 'C' };
  }
  if (substituted.length > 0) {
    return { verdict: 'close', bracket: 'B' };
  }
  return { verdict: 'ready_to_play', bracket: 'A' };
}

/**
 * Derives the counters JSONB from the snapshot's breakdown.
 */
function deriveCounters(breakdown: IBreakdown): {
  have: number;
  missing: number;
  partial: number;
} {
  return {
    have: breakdown.exact?.length ?? 0,
    missing: breakdown.missing?.length ?? 0,
    partial: breakdown.substituted?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Owns all reads and writes to `review_aggregate`.
 *
 * The aggregate row is a per-(userId, deckId) cache derived from the
 * latest `deck_readiness_snapshot`. It is not authoritative — callers
 * that need the full breakdown must still query the snapshot directly.
 *
 * Ownership: every public read/write is scoped to the supplied `userId`.
 * `computeForDeck` additionally requires a deck that exists in
 * `tracked_deck`, but does NOT re-assert ownership because callers
 * (e.g., post-snapshot-store hooks) are internal services that have
 * already validated ownership through their own means.
 */
@Injectable()
export class ReviewAggregateService {
  private readonly logger = new Logger(ReviewAggregateService.name);

  constructor(
    @InjectRepository(ReviewAggregateEntity)
    private readonly aggregateRepo: Repository<ReviewAggregateEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
  ) {}

  /**
   * Computes (or recomputes) the review aggregate for a single deck.
   *
   * Fetches the latest snapshot for the deck, derives verdict + counters
   * from its breakdown JSONB, then upserts the aggregate row.
   *
   * Returns the saved entity, or `null` when no snapshot exists yet
   * (i.e., the deck has never been analysed).
   *
   * Idempotent: calling twice with the same (userId, deckId) updates the
   * existing row rather than inserting a duplicate.
   */
  async computeForDeck(
    userId: string,
    deckId: number,
  ): Promise<ReviewAggregateEntity | null> {
    // 1. Fetch the latest snapshot for this deck.
    const snapshot = await this.snapshotRepo
      .createQueryBuilder('snap')
      .where('snap.trackedDeckId = :deckId', { deckId })
      .orderBy('snap.computedAt', 'DESC')
      .limit(1)
      .getOne();

    if (!snapshot) {
      this.logger.debug('No snapshot found for deck; skipping aggregate compute', {
        userId,
        deckId,
      });
      return null;
    }

    // 2. Derive verdict, bracket, and counters from the breakdown JSONB.
    const breakdown = snapshot.breakdown as unknown as IBreakdown;
    const { verdict, bracket } = deriveVerdictAndBracket(breakdown);
    const counters = deriveCounters(breakdown);

    // 3. Upsert: update if a row already exists, insert otherwise.
    const existing = await this.aggregateRepo.findOne({
      where: { userId, deckId },
    });

    if (existing) {
      existing.status = 'ready';
      existing.lastComputedAt = new Date();
      existing.verdict = verdict;
      existing.counters = counters;
      existing.bracket = bracket;
      const updated = await this.aggregateRepo.save(existing);
      this.logger.log('Review aggregate updated', { userId, deckId, verdict, bracket });
      return updated;
    }

    const created = this.aggregateRepo.create({
      userId,
      deckId,
      status: 'ready',
      lastComputedAt: new Date(),
      verdict,
      counters,
      bracket,
    });
    const saved = await this.aggregateRepo.save(created);
    this.logger.log('Review aggregate created', { userId, deckId, verdict, bracket });
    return saved;
  }

  /**
   * Returns all review aggregate rows for a user, in no guaranteed order.
   *
   * Ownership: scoped to `userId`; rows for other users are never returned.
   */
  async getForUser(userId: string): Promise<ReviewAggregateEntity[]> {
    return this.aggregateRepo.find({ where: { userId } });
  }

  /**
   * Returns the review aggregate for a specific (user, deck) pair,
   * or `null` when no aggregate row exists yet.
   */
  async getForUserDeck(
    userId: string,
    deckId: number,
  ): Promise<ReviewAggregateEntity | null> {
    return this.aggregateRepo.findOne({ where: { userId, deckId } });
  }
}
