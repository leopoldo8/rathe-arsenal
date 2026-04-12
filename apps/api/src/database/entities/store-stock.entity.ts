import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StoreEntity } from './store.entity';

/**
 * One row per (store, cardIdentifier) pair representing the latest scraped
 * stock snapshot. The scraper upserts into this table on each run.
 *
 * Absent-after-scrape rows are NOT deleted — their `quantity` is set to 0
 * and `lastFetchedAt` is updated. The shopping line query filters
 * `quantity > 0` at read time, so zero-quantity rows are invisible to users
 * but preserve `productUrl` and `productNameRaw` for debugging.
 *
 * Product URLs are validated at write time (https:// + hostname allow-list)
 * and re-validated at render time by <StoreProductLink />.
 */
@Entity({ name: 'store_stock' })
@Index(['storeId', 'cardIdentifier'], { unique: true })
export class StoreStockEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  storeId!: number;

  /**
   * Canonical card identifier from @flesh-and-blood/cards.
   * Example: 'hammer-of-gravi-the-lightning-armory-red'
   */
  @Column({ type: 'varchar', length: 150 })
  cardIdentifier!: string;

  /**
   * Price in BRL cents. Null when the store renders "Sob consulta" or
   * any other non-numeric placeholder.
   */
  @Column({ type: 'int', nullable: true })
  priceCents!: number | null;

  /**
   * Current stock quantity. Zero-quantity rows are retained for
   * reconciliation continuity (see class-level comment).
   */
  @Column({ type: 'int', default: 0 })
  quantity!: number;

  /**
   * Fully-qualified product URL validated at write time.
   * Must be https:// and hostname must match the store's baseUrl.
   */
  @Column({ type: 'varchar', length: 1000 })
  productUrl!: string;

  /**
   * Raw product name exactly as scraped. Not rendered to end users — used
   * only for debugging unmatched rows and populating the card_alias table.
   */
  @Column({ type: 'varchar', length: 500 })
  productNameRaw!: string;

  /** Wall-clock time this row was last written by the scraper. */
  @Column({ type: 'timestamptz' })
  lastFetchedAt!: Date;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store!: StoreEntity;
}
