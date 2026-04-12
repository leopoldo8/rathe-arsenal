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
 * Status values for a scrape run lifecycle.
 *
 * - running:           scrape is in progress (soft lock: stale after 30 min)
 * - completed:         scrape finished and all changes were persisted
 * - failed:            scrape aborted due to an unhandled error
 * - paused_delta_guard: scrape aborted because the computed delta exceeded
 *                       the 90% threshold (S11). No changes were persisted.
 *                       Subsequent scheduled runs refuse to start until an
 *                       operator triggers a forced override.
 */
export enum EStoreScrapeRunStatus {
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  PausedDeltaGuard = 'paused_delta_guard',
}

/**
 * Audit trail for every scrape attempt. Also acts as a soft lock (the
 * most recent `running` row blocks concurrent runs older than 30 min) and
 * as the delta-guard history (exemption applies only when zero `completed`
 * rows exist for the store).
 *
 * `forcedOverride` is true when the run bypassed a prior `paused_delta_guard`
 * state via the admin endpoint's `force=true` param, allowing post-incident
 * audits to distinguish normal runs from operator-forced runs.
 */
@Entity({ name: 'store_scrape_run' })
@Index(['storeId', 'startedAt'])
export class StoreScrapeRunEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  storeId!: number;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  productsFetched!: number;

  @Column({ type: 'int', default: 0 })
  productsMatched!: number;

  @Column({ type: 'int', default: 0 })
  productsUnmatched!: number;

  @Column({ type: 'int', default: 0 })
  rowsUpserted!: number;

  /**
   * Count of `store_stock` rows set to `quantity = 0` because the product
   * was absent in this scrape run (reconciliation policy: zero out, not delete).
   */
  @Column({ type: 'int', default: 0 })
  rowsZeroed!: number;

  /**
   * Percentage of existing stock rows that would be affected (upserted +
   * zeroed) relative to the prior row count. Null until the delta check runs.
   * Triggers the delta guard when > 90.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  deltaPercent!: number | null;

  @Column({
    type: 'enum',
    enum: EStoreScrapeRunStatus,
    default: EStoreScrapeRunStatus.Running,
  })
  status!: EStoreScrapeRunStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  /**
   * True when this run bypassed a prior paused_delta_guard via force=true.
   * Preserved in the audit trail so operators can distinguish normal
   * completed runs from forced ones during post-incident review.
   */
  @Column({ type: 'boolean', default: false })
  forcedOverride!: boolean;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store!: StoreEntity;
}
