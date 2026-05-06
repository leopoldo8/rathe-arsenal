import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReviewAggregateEntity } from '../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstituteDecisionEntity } from '../database/entities/substitute-decision.entity';
import { CatalogService } from '../catalog/catalog.service';

// ---------------------------------------------------------------------------
// Internal types mirroring the engine's IReadinessBreakdown shape.
// We do not import the engine here to avoid a cross-layer dependency in the
// service; the JSONB breakdown is treated as an opaque structure and only the
// fields we need are accessed defensively.
// ---------------------------------------------------------------------------

interface IImageUrl {
  readonly small: string;
  readonly large: string;
  readonly sources?: readonly { readonly small: string; readonly large: string }[];
}

interface IBreakdownEntry {
  readonly cardIdentifier: string;
  /** Human-readable card name from catalog. Optional in legacy snapshots. */
  readonly name?: string;
  readonly quantity: number;
  readonly pitch?: 1 | 2 | 3 | null;
  readonly type?: string;
  readonly imageUrl?: IImageUrl | null;
}

interface ISubstituteCardSnapshot {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch?: number | null;
  readonly imageUrl?: IImageUrl | null;
}

interface ISubstitutionMatchSnapshot {
  readonly substitute: ISubstituteCardSnapshot;
  readonly tier: number;
  readonly score: number;
  readonly rationale: string;
}

interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatchSnapshot;
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
 * Public image URL pair (small + large WebP). The snapshot also carries a
 * `sources` mirror list, but the Reviews wire format keeps only the canonical
 * pair to keep payloads compact.
 */
export interface IReviewImageUrl {
  readonly small: string;
  readonly large: string;
}

/**
 * A single substitution row returned by `listSubstitutionRows`.
 * Represents one substituted card in one deck that may require a review
 * decision. Wire format mirrors the frontend `IReviewRow` contract.
 */
export interface ISubstitutionRow {
  readonly trackedDeckId: number;
  readonly deckName: string;
  readonly hero: string;
  readonly cardIdentifier: string;
  /**
   * Human-readable name for the original card (from catalog). Falls back to
   * `cardIdentifier` when the card is not in the catalog. UI renders `originalName`.
   */
  readonly originalName: string;
  readonly substituteIdentifier: string;
  readonly substituteName: string;
  readonly tier: 1 | 2 | 3;
  /** Confidence score 0–100 (rounded). Derived from the engine match score. */
  readonly confidence: number;
  readonly rationale: string;
  /** Decision state. Field name mirrors frontend `IReviewRow.decision`. */
  readonly decision: TReviewState;
  readonly originalImageUrl: IReviewImageUrl | null;
  readonly substituteImageUrl: IReviewImageUrl | null;
  readonly originalPitch: 1 | 2 | 3 | null;
  readonly substitutePitch: 1 | 2 | 3 | null;
  readonly originalType: string;
  readonly substituteType: string;
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
    private readonly catalogService: CatalogService,
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
    // 1. Fetch all tracked decks for this user (with hero for enrichment).
    const decks = await this.trackedDeckRepo.find({
      where: { userId },
      select: ['id', 'name', 'hero'],
    });

    if (decks.length === 0) {
      return [];
    }

    const deckIds = decks.map((d) => d.id);
    const deckById = new Map<number, { name: string; hero: string }>(
      decks.map((d) => [d.id, { name: d.name, hero: d.hero }]),
    );

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

    // 3. Collect substituted entries with their owning trackedDeckId.
    const substitutedRows: Array<{
      trackedDeckId: number;
      entry: ISubstitutedEntry;
    }> = [];
    for (const snapshot of latestSnapshots) {
      const breakdown = snapshot.breakdown as unknown as IBreakdown;
      const substituted = breakdown.substituted ?? [];
      for (const entry of substituted) {
        substitutedRows.push({ trackedDeckId: snapshot.trackedDeckId, entry });
      }
    }

    if (substitutedRows.length === 0) {
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

    // 5. Compose enriched rows.
    const rows: ISubstitutionRow[] = [];
    for (const { trackedDeckId, entry } of substitutedRows) {
      const original = entry.original;
      const match = entry.match;
      const substitute = match.substitute;

      // Decisions are keyed by the SUBSTITUTE id — the same identifier written
      // by ReviewsRow (after Fix 1) and read by deck-detail's BreakdownSections.
      // Using original.cardIdentifier here was the root cause: it produced
      // orphaned rows that deck-detail (keying by substitute) could never find.
      const existingDecision = decisionMap.get(
        `${trackedDeckId}:${substitute.cardIdentifier}`,
      );
      const decision: TReviewState = existingDecision ?? 'pending';

      if (stateFilter !== 'all' && decision !== stateFilter) {
        continue;
      }

      const deckMeta = deckById.get(trackedDeckId);

      rows.push({
        trackedDeckId,
        deckName: deckMeta?.name ?? '',
        hero: deckMeta?.hero ?? '',
        cardIdentifier: original.cardIdentifier,
        originalName: original.name ?? this.lookupName(original.cardIdentifier),
        substituteIdentifier: substitute.cardIdentifier,
        substituteName: substitute.name,
        tier: this.normalizeTier(match.tier),
        confidence: this.normalizeConfidence(match.score),
        rationale: match.rationale,
        decision,
        originalImageUrl: this.compactImageUrl(original.imageUrl),
        substituteImageUrl: this.compactImageUrl(substitute.imageUrl),
        originalPitch: this.normalizePitch(original.pitch ?? null),
        substitutePitch: this.normalizePitch(substitute.pitch ?? null),
        originalType: original.type ?? 'unknown',
        substituteType: this.lookupType(substitute.cardIdentifier),
      });
    }

    return rows;
  }

  /**
   * Clamps the tier value into the supported {1, 2, 3} domain. Engine tiers
   * outside this range are treated as tier 3 (least confident) — defensive
   * fallback for legacy snapshots.
   */
  private normalizeTier(tier: number): 1 | 2 | 3 {
    if (tier === 1 || tier === 2 || tier === 3) {
      return tier;
    }
    return 3;
  }

  /**
   * Translates the engine match score into a 0–100 confidence integer.
   * The engine emits scores in 0–1 (continuous); the frontend renders
   * `${row.confidence}%`. Snapshots written before this contract may already
   * carry 0–100 values, so values >1 are passed through with rounding.
   */
  private normalizeConfidence(score: number): number {
    if (!Number.isFinite(score)) return 0;
    const scaled = score <= 1 ? score * 100 : score;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }

  /**
   * Restricts the pitch value to the {1, 2, 3, null} domain expected by the
   * frontend. Snapshot data is permissive (any number); anything outside the
   * domain is treated as null (pitch-less card).
   */
  private normalizePitch(pitch: number | null): 1 | 2 | 3 | null {
    if (pitch === 1 || pitch === 2 || pitch === 3) return pitch;
    return null;
  }

  /**
   * Strips the `sources` mirror list from the snapshot's image URL pair,
   * keeping only the canonical small/large fields the frontend needs.
   */
  private compactImageUrl(
    image: IImageUrl | null | undefined,
  ): IReviewImageUrl | null {
    if (!image) return null;
    return { small: image.small, large: image.large };
  }

  /**
   * Looks up the substitute card's primary type from the in-process catalog.
   * Falls back to 'unknown' when the catalog has no matching card (e.g.,
   * a legacy snapshot referencing a card that has since been retired).
   */
  private lookupType(cardIdentifier: string): string {
    try {
      const card = this.catalogService.getCard(cardIdentifier);
      return card.types?.[0] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Looks up the human-readable card name from the catalog. Falls back to
   * the identifier when the card is not in the catalog. Used to enrich
   * legacy snapshots that predate B1 (entries persisted without `name`).
   */
  private lookupName(cardIdentifier: string): string {
    try {
      const card = this.catalogService.getCard(cardIdentifier);
      return card.name || cardIdentifier;
    } catch {
      return cardIdentifier;
    }
  }
}
