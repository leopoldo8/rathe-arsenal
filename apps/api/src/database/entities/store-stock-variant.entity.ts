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
 * One row per (store, cardIdentifier, edition, condition, finish) tuple
 * representing a single variant fetched from a store's detail page.
 *
 * Detail pages are fetched on demand (user-triggered) and persisted via
 * upsert on the composite unique index. Each variant row carries snapshot
 * columns that mirror the listing row's price and quantity at fetch time.
 * At read time the shopping line service compares the live listing values
 * against the snapshot to detect staleness:
 *
 *   stale  = store_stock.priceCents   != listingPriceCentsSnapshot
 *           OR store_stock.quantity   != listingQuantitySnapshot
 *
 * Stale variant data falls back to listing-level estimate rather than
 * displaying a potentially misleading breakdown.
 *
 * listingPriceCentsSnapshot is nullable to accommodate cards whose listing
 * row shows "Sob consulta" (null priceCents). The variant row is still valid
 * even when no snapshot price is available.
 */
@Entity({ name: 'store_stock_variant' })
@Index(
  ['storeId', 'cardIdentifier', 'edition', 'condition', 'finish'],
  { unique: true },
)
@Index(['storeId', 'cardIdentifier'])
export class StoreStockVariantEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  storeId!: number;

  /**
   * Canonical card identifier from @flesh-and-blood/cards.
   * Inherited from the parent store_stock row — no re-matching needed.
   * Example: 'hammer-of-gravi-the-lightning-armory-red'
   */
  @Column({ type: 'varchar', length: 150 })
  cardIdentifier!: string;

  /**
   * Edition abbreviation as scraped from the detail page.
   * Example: 'ROS', '1HP', 'FAB'
   * Free-text varchar — normalized to trimmed uppercase during parsing.
   */
  @Column({ type: 'varchar', length: 50 })
  edition!: string;

  /**
   * Condition code as scraped from the detail page.
   * Example: 'NM', 'LP', 'MP'
   * Free-text varchar — normalized to trimmed uppercase during parsing.
   */
  @Column({ type: 'varchar', length: 50 })
  condition!: string;

  /**
   * Finish descriptor as scraped from the detail page.
   * Example: 'Normal', 'Foil', 'Cold Foil'
   * Free-text varchar — normalized during parsing.
   */
  @Column({ type: 'varchar', length: 50 })
  finish!: string;

  /**
   * Variant price in BRL cents as scraped from the detail page.
   * This is the authoritative price for shopping line cost computation
   * when the variant data is fresh.
   */
  @Column({ type: 'int' })
  priceCents!: number;

  /**
   * In-stock quantity for this variant as scraped from the detail page.
   */
  @Column({ type: 'int' })
  quantity!: number;

  /** Wall-clock time this row was last written by the detail scraper. */
  @Column({ type: 'timestamptz' })
  detailFetchedAt!: Date;

  /**
   * Snapshot of store_stock.priceCents at the time the detail page was
   * fetched. Used for content-based staleness detection at read time.
   * Nullable because the listing row may have priceCents = null
   * ("Sob consulta") while variant prices are still known.
   */
  @Column({ type: 'int', nullable: true })
  listingPriceCentsSnapshot!: number | null;

  /**
   * Snapshot of store_stock.quantity at the time the detail page was
   * fetched. Used for content-based staleness detection at read time.
   */
  @Column({ type: 'int' })
  listingQuantitySnapshot!: number;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store!: StoreEntity;
}
