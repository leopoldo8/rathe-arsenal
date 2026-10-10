import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';

@Entity({ name: 'recommendation_dismissal' })
@Index('IDX_recommendation_dismissal_deck_card', ['trackedDeckId', 'cardIdentifier'], { unique: true })
export class RecommendationDismissalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
