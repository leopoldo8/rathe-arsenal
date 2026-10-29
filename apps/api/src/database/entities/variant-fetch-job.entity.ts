import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Lifecycle of a variant-fetch job. */
export enum EVariantFetchJobStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
  Canceled = 'canceled',
}

/** Per-card status inside a job's `cards` jsonb column. */
export type TVariantJobCardStatus = 'pending' | 'done' | 'failed';

export interface IVariantJobCard {
  readonly cardIdentifier: string;
  readonly status: TVariantJobCardStatus;
}

/**
 * A queued product-page lookup for one card, shared by every user and deck.
 * Rows are the queue AND the record of when a card was last looked up. A single
 * continuous worker claims `pending` rows via `FOR UPDATE SKIP LOCKED`.
 */
@Entity({ name: 'variant_fetch_job' })
@Index(['status', 'enqueuedAt'])
@Index('IDX_variant_fetch_job_pending_card', ['cardIdentifier'], { unique: true, where: `"status" = 'pending'` })
export class VariantFetchJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  cardIdentifier!: string;

  @Column({ type: 'int' })
  storeId!: number;

  @Column({ type: 'varchar', length: 20, default: EVariantFetchJobStatus.Pending })
  status!: EVariantFetchJobStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  cards!: IVariantJobCard[];

  @Column({ type: 'int', default: 0 })
  total!: number;

  @Column({ type: 'int', default: 0 })
  completed!: number;

  @Column({ type: 'int', default: 0 })
  failed!: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  enqueuedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claimedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
