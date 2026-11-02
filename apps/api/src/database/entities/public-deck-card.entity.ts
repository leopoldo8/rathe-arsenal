import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PublicDeckEntity } from './public-deck.entity';

@Entity({ name: 'public_deck_card' })
@Index('UQ_public_deck_card_deck_card', ['publicDeckId', 'cardIdentifier'], { unique: true })
@Check('CHK_public_deck_card_quantity', '"quantity" BETWEEN 1 AND 99')
export class PublicDeckCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  publicDeckId!: string;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  /** Copies in the mainboard, equipment and weapons; the inventory is not stored. */
  @Column({ type: 'int' })
  quantity!: number;

  @ManyToOne(() => PublicDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publicDeckId' })
  publicDeck!: PublicDeckEntity;
}
