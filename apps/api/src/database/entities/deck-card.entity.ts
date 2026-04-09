import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';

/**
 * A single card entry within a tracked deck. The `slot` field indicates
 * where the card sits in the deck (mainboard, equipment, weapon, hero).
 */
@Entity({ name: 'deck_card' })
export class DeckCardEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar' })
  cardIdentifier!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'varchar' })
  slot!: string;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
