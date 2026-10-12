import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tournament_deck' })
@Index('IDX_tournament_deck_hero_format_created', ['heroIdentifier', 'format', 'deckCreatedAt'])
export class TournamentDeckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('UQ_tournament_deck_fabrary_ulid', { unique: true })
  @Column({ type: 'varchar', length: 26 })
  fabraryUlid!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventName!: string | null;

  @Column({ type: 'int', nullable: true })
  placement!: number | null;

  @Column({ type: 'varchar', length: 128 })
  heroIdentifier!: string;

  @Column({ type: 'varchar', length: 64 })
  format!: string;

  @Column({ type: 'timestamptz' })
  deckCreatedAt!: Date;

  @Column({ type: 'timestamptz' })
  syncedAt!: Date;
}
