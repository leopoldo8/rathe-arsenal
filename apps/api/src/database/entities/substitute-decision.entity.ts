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
import { TrackedDeckEntity } from './tracked-deck.entity';

/**
 * Persists the user's explicit 3-state decision about a substitute card
 * within a tracked deck. Only `approved` and `rejected` rows are stored;
 * the absence of a row implies `pending` (default, no-op).
 *
 * Design decisions (Plan A §Key Technical Decisions):
 * - `decision` is varchar+CHECK (not a Postgres native enum) so Phase 2 can
 *   add a third state by replacing the constraint, not dropping the enum type.
 * - Unique index on (userId, trackedDeckId, cardIdentifier) is the upsert
 *   backstop — the service layer relies on it for idempotency.
 * - CASCADE deletes on both FKs clean up rows when a user or deck is removed.
 */
@Entity({ name: 'substitute_decision' })
@Index(['userId', 'trackedDeckId', 'cardIdentifier'], { unique: true })
@Index(['trackedDeckId', 'decision'])
export class SubstituteDecisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  /**
   * User's explicit decision for this card in this deck.
   * Enforced by CHECK constraint: only 'approved' or 'rejected' are valid.
   * The absence of a row means 'pending' (implicit default).
   */
  @Column({ type: 'varchar', length: 32 })
  decision!: 'approved' | 'rejected';

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
