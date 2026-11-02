import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A public player deck read from Fabrary for the recommendation usage signal (AD-029). Only ids, dates and cards are kept. */
@Entity({ name: 'public_deck' })
@Index('IDX_public_deck_hero_format', ['heroIdentifier', 'format'])
export class PublicDeckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('UQ_public_deck_fabrary_ulid', { unique: true })
  @Column({ type: 'varchar', length: 26 })
  fabraryUlid!: string;

  @Column({ type: 'varchar', length: 128 })
  heroIdentifier!: string;

  @Column({ type: 'varchar', length: 64 })
  format!: string;

  /** SHA-256 of the Fabrary author id, so decks count once per player without storing who the player is. */
  @Column({ type: 'varchar', length: 64 })
  authorKey!: string;

  @Column({ type: 'timestamptz' })
  deckUpdatedAt!: Date;

  @Column({ type: 'timestamptz' })
  fetchedAt!: Date;
}
