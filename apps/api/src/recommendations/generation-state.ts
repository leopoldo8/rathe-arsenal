import { ICatalogCard } from '@rathe-arsenal/engine';
import { TRecommendationRunStatus, TRecommendationRunTrigger } from '../database/entities/recommendation-run.entity';

export const GENERATION_STATUSES = ['queued', 'retrying', 'running'] as const;
export type TGenerationStatus = (typeof GENERATION_STATUSES)[number];

export const POOL_SAMPLE_SIZE = 16;
export const TYPICAL_DURATION_WINDOW = 20;
const TYPICAL_DURATION_MIN_RUNS = 3;

export interface IGenerationRunState {
  readonly status: TRecommendationRunStatus;
  readonly trigger: TRecommendationRunTrigger;
  readonly attempts: number;
  readonly runAfter: Date;
}

export interface IGenerationRunTimes {
  readonly startedAt: Date | null;
  readonly createdAt: Date;
  readonly runAfter: Date;
}

export interface IPoolSampleCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly imageUrl: NonNullable<ICatalogCard['imageUrl']>;
}

/** An auto run waiting out its debounce has not started for anyone yet, so it is not a generation. */
export function deriveGenerationStatus(run: IGenerationRunState, now: Date): TGenerationStatus | null {
  if (run.status === 'running') return 'running';
  if (run.status !== 'pending') return null;
  if (run.attempts > 0) return 'retrying';
  if (run.trigger === 'manual' || run.runAfter.getTime() <= now.getTime()) return 'queued';
  return null;
}

export function measureElapsedMs(run: IGenerationRunTimes, now: Date): number {
  const start = run.startedAt ?? new Date(Math.max(run.createdAt.getTime(), run.runAfter.getTime()));
  return Math.max(0, now.getTime() - start.getTime());
}

export function medianDurationMs(durations: readonly number[]): number | null {
  if (durations.length < TYPICAL_DURATION_MIN_RUNS) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Evenly spaced over the pool sorted by identifier, so every poll of the same deck flips the same cards. */
export function samplePool(pool: readonly ICatalogCard[]): IPoolSampleCard[] {
  const imaged = pool
    .filter((card): card is ICatalogCard & { imageUrl: NonNullable<ICatalogCard['imageUrl']> } => Boolean(card.imageUrl))
    .sort((a, b) => a.cardIdentifier.localeCompare(b.cardIdentifier));
  const count = Math.min(POOL_SAMPLE_SIZE, imaged.length);
  return Array.from({ length: count }, (_, index) => imaged[Math.floor((index * imaged.length) / count)]!).map((card) => ({
    cardIdentifier: card.cardIdentifier,
    name: card.name,
    imageUrl: card.imageUrl,
  }));
}
