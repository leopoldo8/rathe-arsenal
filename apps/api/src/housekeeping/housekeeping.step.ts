import { Logger } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';

/** How often the worker's loop lets a tick through; the loop itself wakes every few seconds. */
export const HOUSEKEEPING_INTERVAL_MS = 10 * 60 * 1000;

export const HOUSEKEEPING_STEP_NAME = 'housekeeping';

export interface IHousekeepingStepDeps {
  readonly service: Pick<HousekeepingService, 'tick'>;
  readonly logger: Pick<Logger, 'error'>;
  readonly now?: () => Date;
  readonly intervalMs?: number;
}

/**
 * The housekeeping loop's step. It ticks at most once per interval after a tick that worked; a tick that
 * throws is logged with the step name and the next call tries again at once, so one bad run never stops the loop.
 */
export function createHousekeepingStep(deps: IHousekeepingStepDeps): () => Promise<void> {
  const clock = deps.now ?? ((): Date => new Date());
  const intervalMs = deps.intervalMs ?? HOUSEKEEPING_INTERVAL_MS;
  let lastTickAt: number | null = null;
  return async () => {
    const now = clock();
    if (lastTickAt !== null && now.getTime() - lastTickAt < intervalMs) return;
    try {
      await deps.service.tick(now);
      lastTickAt = now.getTime();
    } catch (err) {
      deps.logger.error({ event: 'housekeeping.error', step: HOUSEKEEPING_STEP_NAME, error: (err as Error).message });
    }
  };
}
