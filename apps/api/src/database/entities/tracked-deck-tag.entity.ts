import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';
import { DeckTagEntity } from './deck-tag.entity';

/**
 * Join table linking tracked decks to user-defined tags (R3a, R12a).
 *
 * Design decisions:
 * - Composite PK on (trackedDeckId, tagId) prevents duplicate join rows and
 *   serves as the implicit unique constraint (no separate unique index needed).
 * - Both FKs use CASCADE DELETE: removing a deck or a tag cleans up all join
 *   rows automatically.
 * - `attachedAt` provides ordering/recency context for tag display.
 * - Additional index on tagId enables the efficient "how many decks use this tag?"
 *   count query required by the U4 TOCTOU-safe implicit-deletion sequence.
 */
@Entity({ name: 'tracked_deck_tag' })
@Index(['tagId'])
export class TrackedDeckTagEntity {
  @PrimaryColumn({ type: 'int' })
  trackedDeckId!: number;

  @PrimaryColumn({ type: 'int' })
  tagId!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  attachedAt!: Date;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;

  @ManyToOne(() => DeckTagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag!: DeckTagEntity;
}
