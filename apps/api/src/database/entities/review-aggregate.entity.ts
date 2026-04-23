import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { TrackedDeckEntity } from './tracked-deck.entity';

/**
 * Per-(user, deck) summary of readiness computed from the latest
 * `deck_readiness_snapshot`. Serves as a fast read-model for the
 * cross-deck Reviews surface so callers don't need to re-aggregate
 * the snapshot JSONB on every request.
 *
 * Design notes:
 * - `status` tracks the computation lifecycle so that stale rows can be
 *   invalidated (set to 'stale') when a new snapshot is stored, and
 *   re-promoted to 'ready' after compute completes.
 * - `verdict` is the high-level readiness classification:
 *     'ready_to_play'  → rawPercent = 100 (Path A)
 *     'close'          → effectivePercent = 100 but rawPercent < 100 (Path B)
 *     'not_ready'      → some cards still missing (Path C)
 * - `counters` is a closed JSONB blob `{ have, missing, partial }` where:
 *     have    = count of exactly-owned cards
 *     missing = count of cards with no coverage (missing entries)
 *     partial = count of cards covered only via substitution
 * - `bracket` maps to the engine's TPath ('A' | 'B' | 'C') and is
 *   nullable — will be null only on legacy/computing rows before the
 *   first compute completes.
 * - Unique constraint on (userId, deckId) is the upsert backstop.
 */
@Entity({ name: 'review_aggregate' })
@Index(['userId', 'deckId'], { unique: true })
@Index(['userId'])
@Check(
  'CHK_review_aggregate_status_valid',
  `"status" IN ('ready', 'computing', 'stale')`,
)
@Check(
  'CHK_review_aggregate_verdict_valid',
  `"verdict" IS NULL OR "verdict" IN ('ready_to_play', 'close', 'not_ready')`,
)
@Check(
  'CHK_review_aggregate_bracket_valid',
  `"bracket" IS NULL OR "bracket" IN ('A', 'B', 'C')`,
)
export class ReviewAggregateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  deckId!: number;

  /**
   * Computation lifecycle state.
   * - 'computing': a compute is in-flight; row may have stale counters.
   * - 'ready':     counters + verdict are up-to-date with the latest snapshot.
   * - 'stale':     a newer snapshot exists; re-compute is pending.
   */
  @Column({ type: 'varchar', length: 16 })
  status!: 'ready' | 'computing' | 'stale';

  /**
   * Timestamp of the most recent successful compute.
   * Null before the first compute completes.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastComputedAt!: Date | null;

  /**
   * High-level readiness verdict derived from the snapshot path.
   * Null while status is 'computing' or 'stale' and no prior result exists.
   */
  @Column({ type: 'varchar', length: 24, nullable: true })
  verdict!: 'ready_to_play' | 'close' | 'not_ready' | null;

  /**
   * Card ownership counters derived from the latest snapshot breakdown.
   * `have`    = count of IBreakdownEntry rows in `breakdown.exact`.
   * `missing` = count of IBreakdownEntry rows in `breakdown.missing`.
   * `partial` = count of ISubstitutedEntry rows in `breakdown.substituted`.
   */
  @Column({ type: 'jsonb' })
  counters!: { have: number; missing: number; partial: number };

  /**
   * Engine path classification ('A' | 'B' | 'C') from the latest snapshot.
   * Null until the first compute completes.
   */
  @Column({ type: 'varchar', length: 4, nullable: true })
  bracket!: 'A' | 'B' | 'C' | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck!: TrackedDeckEntity;
}
