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
 * Point-in-time snapshot of a deck's readiness score, including the
 * detailed breakdown and suggested substitutions. Immutable once created.
 */
@Entity({ name: 'deck_readiness_snapshot' })
@Index(['trackedDeckId', 'computedAt'])
export class DeckReadinessSnapshotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'float' })
  rawPercent!: number;

  @Column({ type: 'float' })
  effectivePercent!: number;

  @Column({ type: 'jsonb' })
  breakdown!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  substitutions!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  computedAt!: Date;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
