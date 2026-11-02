import { Column, Entity, PrimaryColumn } from 'typeorm';

/** When the public decks of one hero and format were last read from Fabrary; a refresh is due after a TTL. */
@Entity({ name: 'public_deck_refresh' })
export class PublicDeckRefreshEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  heroIdentifier!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  format!: string;

  @Column({ type: 'timestamptz' })
  refreshedAt!: Date;

  @Column({ type: 'int' })
  decks!: number;
}
