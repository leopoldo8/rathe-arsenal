import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditBudgetService } from './credit-budget.service';
import { readStoreAnswersConfig } from './store-answers.config';
import { IAvailabilityStatus, StoreIngestionService } from './store-ingestion.service';
import { nextSweepAttemptAt } from './sweep-backoff';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IAvailabilityStepDeps {
  readonly ingestion: Pick<StoreIngestionService, 'listActiveStoreSlugs' | 'getAvailabilityStatus' | 'requestUrlSync'>;
  readonly budget: Pick<CreditBudgetService, 'passFits'>;
  readonly config: Pick<ConfigService, 'get'>;
  readonly logger: Pick<Logger, 'error'>;
  readonly runPendingUrlSync: () => Promise<void>;
  readonly now?: () => Date;
}

function isPassDue(status: IAvailabilityStatus, passDays: number, now: Date): boolean {
  if (status.syncQueuedOrRunning) return false;
  if (status.lastFailureAt !== null) {
    const failure = { failures: status.failureCount, failedAt: status.lastFailureAt, error: status.lastError };
    if (now.getTime() < nextSweepAttemptAt(failure, passDays).getTime()) return false;
  }
  if (status.lastPassAt === null) return true;
  return now.getTime() - status.lastPassAt.getTime() >= passDays * DAY_MS;
}

export function createAvailabilityStep(deps: IAvailabilityStepDeps): () => Promise<void> {
  const clock = deps.now ?? ((): Date => new Date());
  return async () => {
    try {
      const { availabilityPassDays } = readStoreAnswersConfig(deps.config);
      for (const slug of await deps.ingestion.listActiveStoreSlugs()) {
        const now = clock();
        const status = await deps.ingestion.getAvailabilityStatus(slug, now);
        if (!isPassDue(status, availabilityPassDays, now)) continue;
        if (!(await deps.budget.passFits(now))) continue;
        await deps.ingestion.requestUrlSync(slug);
        await deps.runPendingUrlSync();
      }
    } catch (err) {
      deps.logger.error({ event: 'availability-pass.error', error: (err as Error).message });
    }
  };
}
