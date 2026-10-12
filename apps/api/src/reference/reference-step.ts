import { Logger } from '@nestjs/common';
import { RulesImportService } from './rules-import.service';
import { ISyncClock, REAL_CLOCK, TournamentSyncService } from './tournament-sync.service';

export interface IReferenceStepDeps {
  readonly tournaments: Pick<TournamentSyncService, 'isDue' | 'sync'>;
  readonly rules: Pick<RulesImportService, 'isDue' | 'importIndex'>;
  readonly logger: Pick<Logger, 'error'>;
  readonly clock?: ISyncClock;
}

/** One pass of the reference loop: each source refreshes only when its stored data is a day old. */
export function createReferenceStep(deps: IReferenceStepDeps): () => Promise<void> {
  const clock = deps.clock ?? REAL_CLOCK;
  return async () => {
    try {
      if (await deps.tournaments.isDue(clock.now())) await deps.tournaments.sync(clock);
    } catch (err) {
      deps.logger.error({ event: 'tournament.sync.error', error: (err as Error).message });
    }
    try {
      if (await deps.rules.isDue(clock.now())) await deps.rules.importIndex(undefined, clock.now());
    } catch (err) {
      deps.logger.error({ event: 'rules.sync.error', error: (err as Error).message });
    }
  };
}
