import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';

/**
 * Persisted user intent that says "do not suggest this card as a
 * substitute for any missing copy in this tracked deck". Scoped per
 * tracked deck — a rejection in deck A does not affect deck B.
 *
 * Deleting the parent tracked deck cascades these rows, so untracking
 * a deck cleans up all rejections for it in a single delete.
 *
 * This is **user intent**, not engine learning data (which lives in
 * a different R25 table in Phase 2).
 */
@Entity({ name: 'rejected_substitute' })
@Index(['trackedDeckId', 'cardIdentifier'], { unique: true })
export class RejectedSubstituteEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 100 })
  cardIdentifier!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  rejectedAt!: Date;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
