import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per allow-listed store. Phase 1b ships with a single row:
 * Cúpula DT (slug='cupula-dt'), seeded by migration.
 *
 * Consent artifact for Cúpula DT is documented in:
 *   docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md
 * (personal friend of project owner; crawl-rate exception granted)
 *
 * SQL COMMENT ON TABLE store IS '<consent-artifact-ref>' — see migration.
 */
@Entity({ name: 'store' })
export class StoreEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * URL-safe identifier used as the store's public key throughout the app
   * and in admin endpoint paths. Example: 'cupula-dt'.
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Root URL of the store. Example: 'https://www.cupuladt.com.br' */
  @Column({ type: 'varchar', length: 500 })
  baseUrl!: string;

  /**
   * Path + query string for the FaB product listing page.
   * Example: '/?view=ecom/itens&tcg=8'
   */
  @Column({ type: 'varchar', length: 500 })
  listingPath!: string;

  /**
   * Minimum milliseconds to wait between outbound requests to this store.
   * Encodes the Gate 2 friend-exception: Cúpula DT is seeded with 1500ms,
   * well inside the 1-2s window the owner granted. Any future store defaults
   * to 360_000ms (robots.txt Crawl-delay) unless a specific artifact exists.
   */
  @Column({ type: 'int' })
  rateLimitMs!: number;

  /** When false, scheduled and on-demand scrapes skip this store. */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Timestamp of the most recent completed scrape run for this store. */
  @Column({ type: 'timestamptz', nullable: true })
  lastScrapedAt!: Date | null;

  /**
   * Persists the wall-clock time of the last outbound fetch so the in-process
   * rate limiter can compute the remaining delay after a pod restart or
   * across multiple scrape sessions.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastFetchedAt!: Date | null;

  /**
   * Timestamp of the last completed URL/name sync (productUrl discovery).
   * The variant queue worker reads this on boot so a redeploy within the sync
   * interval skips the full catalog re-scrape instead of repeating it every
   * restart.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastUrlSyncAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
