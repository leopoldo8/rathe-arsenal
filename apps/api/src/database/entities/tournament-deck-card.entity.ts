import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TournamentDeckEntity } from './tournament-deck.entity';

@Entity({ name: 'tournament_deck_card' })
@Index('UQ_tournament_deck_card_deck_card', ['tournamentDeckId', 'cardIdentifier'], { unique: true })
export class TournamentDeckCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tournamentDeckId!: string;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ type: 'int', default: 0 })
  sideboardQuantity!: number;

  @ManyToOne(() => TournamentDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentDeckId' })
  tournamentDeck!: TournamentDeckEntity;
}
