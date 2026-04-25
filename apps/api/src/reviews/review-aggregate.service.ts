import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReviewAggregateEntity } from '../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstituteDecisionEntity } from '../database/entities/substitute-decision.entity';

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
// Cross-deck substitution row (U5 GET /api/reviews response)
// ---------------------------------------------------------------------------

/**
 * Decision state for a substitution row.
 * 'pending' is virtual — absence of a `substitute_decision` row implies pending.
 */
export type TReviewState = 'pending' | 'approved' | 'rejected';

/**
 * A single substitution row returned by `listSubstitutionRows`.
 * Represents one missing card in one deck that has (or could have) a substitute.
 */
export interface ISubstitutionRow {
  readonly trackedDeckId: number;
  readonly deckName: string;
  readonly cardIdentifier: string;
  readonly state: TReviewState;
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
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(SubstituteDecisionEntity)
    private readonly decisionRepo: Repository<SubstituteDecisionEntity>,
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

  /**
   * Returns cross-deck substitution rows for the user, optionally filtered
   * by decision state.
   *
   * For each tracked deck, fetches the latest snapshot and extracts entries
   * from `breakdown.substituted[]` (cards covered only via substitute).
   * Joins with `substitute_decision` to derive the state:
   *   - Row present with decision='approved' → 'approved'
   *   - Row present with decision='rejected' → 'rejected'
   *   - No row → 'pending' (virtual state)
   *
   * Ownership: scoped to `userId`; decks and decisions for other users
   * are never returned.
   *
   * U5 (GET /api/reviews): powers the cross-deck Reviews surface.
   */
  async listSubstitutionRows(
    userId: string,
    stateFilter: TReviewState | 'all' = 'pending',
  ): Promise<ISubstitutionRow[]> {
    // 1. Fetch all tracked decks for this user.
    const decks = await this.trackedDeckRepo.find({
      where: { userId },
      select: ['id', 'name'],
    });

    if (decks.length === 0) {
      return [];
    }

    const deckIds = decks.map((d) => d.id);
    const deckNameById = new Map<number, string>(decks.map((d) => [d.id, d.name]));

    // 2. Fetch the latest snapshot per deck (subquery pattern from DecksService).
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
      return [];
    }

    // 3. Collect all (trackedDeckId, cardIdentifier) pairs from substituted entries.
    const substitutedPairs: Array<{ trackedDeckId: number; cardIdentifier: string }> = [];
    for (const snapshot of latestSnapshots) {
      const breakdown = snapshot.breakdown as unknown as IBreakdown;
      const substituted = breakdown.substituted ?? [];
      for (const entry of substituted) {
        substitutedPairs.push({
          trackedDeckId: snapshot.trackedDeckId,
          cardIdentifier: entry.original.cardIdentifier,
        });
      }
    }

    if (substitutedPairs.length === 0) {
      return [];
    }

    // 4. Batch-load all existing decisions for these decks to avoid N+1 queries.
    const existingDecisions = await this.decisionRepo.find({
      where: { userId, trackedDeckId: In(deckIds) },
      select: ['trackedDeckId', 'cardIdentifier', 'decision'],
    });

    // Build lookup: `${trackedDeckId}:${cardIdentifier}` → decision state
    const decisionMap = new Map<string, 'approved' | 'rejected'>();
    for (const d of existingDecisions) {
      decisionMap.set(`${d.trackedDeckId}:${d.cardIdentifier}`, d.decision);
    }

    // 5. Compose rows with state.
    const rows: ISubstitutionRow[] = [];
    for (const pair of substitutedPairs) {
      const existingDecision = decisionMap.get(
        `${pair.trackedDeckId}:${pair.cardIdentifier}`,
      );
      const state: TReviewState = existingDecision ?? 'pending';

      if (stateFilter !== 'all' && state !== stateFilter) {
        continue;
      }

      rows.push({
        trackedDeckId: pair.trackedDeckId,
        deckName: deckNameById.get(pair.trackedDeckId) ?? '',
        cardIdentifier: pair.cardIdentifier,
        state,
      });
    }

    return rows;
  }
}
