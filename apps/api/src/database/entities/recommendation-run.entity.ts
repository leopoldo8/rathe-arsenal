import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';

export const RECOMMENDATION_RUN_TRIGGERS = ['auto', 'manual'] as const;
export type TRecommendationRunTrigger = (typeof RECOMMENDATION_RUN_TRIGGERS)[number];

export const RECOMMENDATION_RUN_STATUSES = ['pending', 'running', 'done', 'failed'] as const;
export type TRecommendationRunStatus = (typeof RECOMMENDATION_RUN_STATUSES)[number];

export const RECOMMENDATION_FAILURE_CODES = [
  'NO_API_KEY',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'MODEL_TIMEOUT',
  'MODEL_REFUSED',
  'MODEL_TRUNCATED',
  'MODEL_OFF_SCHEMA',
  'DECK_INVALID',
  'DECK_RETIRED',
  'WORKER_LOST',
  'SUPERSEDED',
] as const;
export type TRecommendationFailureCode = (typeof RECOMMENDATION_FAILURE_CODES)[number];

// Indexes and CHECKs repeat the migration's: local and e2e databases are built by `synchronize`.
@Check('CHK_recommendation_run_trigger_valid', `"trigger" IN ('auto', 'manual')`)
@Check('CHK_recommendation_run_status_valid', `"status" IN ('pending', 'running', 'done', 'failed')`)
@Entity({ name: 'recommendation_run' })
@Index('IDX_recommendation_run_status_run_after', ['status', 'runAfter'])
@Index('IDX_recommendation_run_deck_status', ['trackedDeckId', 'status'])
@Index('IDX_recommendation_run_one_pending', ['trackedDeckId'], { unique: true, where: `"status" = 'pending'` })
@Index('IDX_recommendation_run_one_running', ['trackedDeckId'], { unique: true, where: `"status" = 'running'` })
export class RecommendationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 16 })
  trigger!: TRecommendationRunTrigger;

  @Column({ type: 'varchar', length: 16 })
  status!: TRecommendationRunStatus;

  @Column({ type: 'timestamptz' })
  runAfter!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deckFingerprint!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'int', nullable: true })
  inputTokens!: number | null;

  /** `candidatesTokenCount` plus `thoughtsTokenCount`. */
  @Column({ type: 'int', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  error!: TRecommendationFailureCode | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
