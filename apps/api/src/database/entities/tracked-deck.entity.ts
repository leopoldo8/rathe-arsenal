import {
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

/**
 * A deck tracked by the user — either imported from Fabrary or created from
 * scratch. The `fabraryUlid` is nullable to support scratch decks (D8).
 *
 * v2 additions (Plan §U1):
 * - `status` — user-assigned lifecycle label (idea | building | ready | active | retired).
 *   Defaults to 'building' for Fabrary imports; 'idea' for scratch decks.
 * - `heroIdentifier` — catalog cardIdentifier for the deck's hero (R24a). Nullable
 *   to tolerate rows whose legacy `hero` display-name could not be resolved at
 *   backfill time; the legality engine treats NULL as category='illegal' with a
 *   user-actionable reason.
 * - `updatedAt` — forward-compat for optimistic locking (D12). TypeORM's
 *   @UpdateDateColumn keeps this in sync on every ORM save.
 * - `fabraryUlid` is now nullable — partial unique index (WHERE IS NOT NULL) enforces
 *   per-user uniqueness only for Fabrary-imported decks. See migration T+4000.
 *
 * The class-level @Index mirrors the migration's partial unique index exactly so
 * that `typeorm schema:log` reports zero drift.
 */
@Entity({ name: 'tracked_deck' })
@Index(['userId', 'fabraryUlid'], { unique: true, where: '"fabraryUlid" IS NOT NULL' })
export class TrackedDeckEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  /**
   * Fabrary deck ULID. Nullable — scratch decks have no Fabrary URL.
   * Uniqueness enforced per user only when non-null (partial unique index
   * IDX_tracked_deck_userId_fabraryUlid_partial created in migration T+4000).
   */
  @Column({ type: 'varchar', nullable: true })
  fabraryUlid!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  /**
   * Legacy hero display name (e.g. "Dorinthea Ironsong"). Kept for backward
   * compat while callers migrate to heroIdentifier. Will be dropped in a
   * follow-up migration once `pnpm grep` confirms no remaining reads.
   */
  @Column({ type: 'varchar' })
  hero!: string;

  /**
   * Catalog cardIdentifier for the deck's hero (e.g. "dorinthea-ironsong").
   * Nullable — rows that existed before the T+5000 backfill that could not be
   * resolved remain NULL; the legality engine surfaces a user-actionable reason.
   * New Fabrary imports set this from `hero.cardIdentifier` (DecksImportService).
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  heroIdentifier!: string | null;

  @Column({ type: 'varchar' })
  format!: string;

  /**
   * User-assigned lifecycle label. Enforced by CHECK constraint
   * CHK_tracked_deck_status_valid: idea | building | ready | active | retired.
   * Default is 'building' (R2 flat default for all Fabrary imports).
   */
  @Column({ type: 'varchar', length: 16, default: 'building' })
  status!: 'idea' | 'building' | 'ready' | 'active' | 'retired';

  @CreateDateColumn({ type: 'timestamptz' })
  trackedAt!: Date;

  /**
   * Forward-compat for optimistic locking (D12). Updated automatically by
   * TypeORM on every ORM save. Seeded with trackedAt for existing rows by
   * migration T+2000.
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
