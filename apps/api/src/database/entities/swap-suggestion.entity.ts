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
 * Persists one swap suggestion group per (trackedDeckId, cardIdentifier,
 * slot, substituteIdentifier) quadruple (AD-006, AD-007, design §3). This
 * replaces `substitute_decision`, which only recorded the substitute's
 * identifier -- it had no room for the original card or the slot, which is
 * why rejecting a substitute today suppresses it for the whole deck instead
 * of the one (original, slot) pair the user actually acted on (design §1,
 * §4).
 *
 * `id` is the stable identifier the five lifecycle endpoints
 * (approve/reject/revert/restore/outcome) operate on, minted once on first
 * insert and reused across every later reconciliation for the same
 * quadruple -- reconciliation only ever updates or retires an existing row,
 * never deletes it (SWAP-01, SWAP-02).
 *
 * Card metadata (name/pitch/type/imageUrl) is deliberately NOT stored here
 * -- it is resolved at read time from the in-process catalog, so the row
 * stays immune to catalog data changing under it.
 */
@Check('CHK_swap_suggestion_status_valid', `status IN ('pending', 'approved', 'rejected', 'retired')`)
@Check('CHK_swap_suggestion_rejection_reason_valid', `"rejectionReason" IS NULL OR "rejectionReason" IN ('not_equivalent', 'dont_own', 'changes_plan', 'prefer_original', 'other')`)
@Check('CHK_swap_suggestion_outcome_valid', `outcome IS NULL OR outcome IN ('worked', 'did_not_work')`)
@Entity({ name: 'swap_suggestion' })
@Index(['trackedDeckId', 'cardIdentifier', 'slot', 'substituteIdentifier'], { unique: true })
@Index(['trackedDeckId', 'status'])
export class SwapSuggestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  /** The original (missing) card this suggestion covers. */
  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  @Column({ type: 'varchar', length: 64 })
  slot!: string;

  @Column({ type: 'varchar', length: 128 })
  substituteIdentifier!: string;

  /** Copies currently mapped to this group -- the per-copy count collapsed into one row (§3, AD-007). */
  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'smallint' })
  tier!: 1 | 2;

  /** 0-100, normalized from the engine's 0-1 match score. */
  @Column({ type: 'float' })
  confidence!: number;

  @Column({ type: 'text' })
  rationale!: string;

  /**
   * varchar+CHECK, not a Postgres native enum -- same reasoning as
   * `substitute_decision`'s original design note: a future state (e.g. a
   * distinct "expired" state) is a constraint replacement, not a
   * drop-and-recreate of an enum type.
   */
  @Column({ type: 'varchar', length: 32 })
  status!: 'pending' | 'approved' | 'rejected' | 'retired';

  @Column({ type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  /**
   * Enum, never the localized display string -- the quoted reason shown in
   * Recusadas must track the active locale at render time, not freeze to
   * whichever locale was active when the chip was clicked.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  rejectionReason!: 'not_equivalent' | 'dont_own' | 'changes_plan' | 'prefer_original' | 'other' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionNote!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  outcome!: 'worked' | 'did_not_work' | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
