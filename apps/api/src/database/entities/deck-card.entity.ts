import {
  Check,
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
 * `quantity` counts the copies in the starting deck and `inventoryQuantity` the copies carried to
 * the tournament outside it; a line holds at least one copy on either side (door 3).
 */
@Check(
  'CHK_deck_card_quantities',
  `quantity >= 0 AND "inventoryQuantity" >= 0 AND quantity + "inventoryQuantity" > 0`,
)
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

  @Column({ type: 'int', default: 0 })
  inventoryQuantity!: number;

  @Column({ type: 'varchar' })
  slot!: string;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
