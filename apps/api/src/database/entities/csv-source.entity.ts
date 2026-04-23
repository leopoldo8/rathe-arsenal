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
 * Tracks a collection import source for a user. Every `collection_card` row
 * belongs to exactly one `CsvSourceEntity` via the `sourceId` FK.
 *
 * Two kind values are supported:
 * - `'manual'` — lazy-created on first manual card entry; one per user; never
 *   visible in the Manage CSVs UI; never deletable or toggleable.
 * - `'csv'` — created when the user uploads a CSV file.
 *
 * `kind` is stored as varchar+CHECK (not a Postgres native enum) so adding
 * future kinds requires only a constraint replacement, not a drop-recreate of
 * the enum type — same rationale as `substitute_decision.decision`.
 *
 * Partial unique indexes (enforced in migration):
 * - `(userId) WHERE kind='manual'` — at most one manual source per user.
 * - `(userId, contentHash) WHERE kind='csv' AND contentHash IS NOT NULL` —
 *   DB-level backstop against exact-match duplicate imports.
 */
@Entity({ name: 'csv_source' })
@Index(['userId'])
@Index(['userId', 'kind'])
export class CsvSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  /**
   * `'csv' | 'manual'`. Enforced by CHECK constraint in migration.
   */
  @Column({ type: 'varchar', length: 16 })
  kind!: 'csv' | 'manual';

  /**
   * Human-readable label. For `kind='manual'` this is always "Manual entries".
   * For `kind='csv'` this defaults to the original filename but can be renamed.
   */
  @Column({ type: 'text', nullable: true })
  label!: string | null;

  /**
   * Original filename of the uploaded CSV. NULL for `kind='manual'`.
   */
  @Column({ type: 'text', nullable: true })
  originalFilename!: string | null;

  /**
   * Source URL for `kind='csv_url'` future variant. NULL for `kind='manual'`
   * and local file uploads.
   */
  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  /**
   * SHA-256 of normalised `(cardIdentifier, quantity)` pairs. NULL for
   * `kind='manual'`. Used for exact-match duplicate detection.
   */
  @Column({ type: 'text', nullable: true })
  contentHash!: string | null;

  /**
   * Number of resolved cards in this source. NULL for `kind='manual'` (the
   * manual source grows dynamically; counting on demand is cheaper than
   * maintaining a running total).
   */
  @Column({ type: 'int', nullable: true, default: null })
  cardCount!: number | null;

  /**
   * When `active=false` this source's cards are excluded from readiness
   * computations and Library totals. `kind='manual'` is always effectively
   * active; the service layer never allows toggling it.
   */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
