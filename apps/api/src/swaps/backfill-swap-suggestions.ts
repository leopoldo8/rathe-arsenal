import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';

/**
 * DEVIATION from design/07-swaps.md's literal path
 * (`apps/api/scripts/backfill-swap-suggestions.ts`): this repo's jest
 * (`rootDir: "src"`), tsc (`include: ["src/**\/*"]`), and eslint
 * (`"src/**\/*.ts"`) configs for `apps/api` only cover `src/`, so a file
 * under a sibling `apps/api/scripts/` directory would be typechecked,
 * linted, and unit-tested by nothing in the required gate. Living at
 * `src/swaps/` instead keeps the pattern the design actually cares about
 * (NestFactory.createApplicationContext, a deps-injected per-deck loop,
 * the `main()` guard) while staying inside every tool's coverage --
 * matching where `variant-queue-worker.ts` itself actually lives
 * (`src/stores/`, not a top-level `scripts/`).
 *
 * Required deploy step, run immediately after the
 * ReplaceSubstituteDecisionWithSwapSuggestion migration -- not optional
 * cleanup (design/07-swaps.md "Landing sequence"). The migration creates
 * `swap_suggestion` empty; without this script the old Swaps screen (still
 * served by the compatibility shim) shows nothing for any deck the user
 * hasn't touched since deploy, and every deck's readiness drops raggedly
 * as decks happen to recompute instead of uniformly at deploy time, which
 * makes D7's accepted trade-off untrue in practice.
 *
 * For every tracked deck, calls `SubstitutionService.computeAndStoreReadiness`
 * with empty exclusion/approval sets (D8 discarded the legacy
 * `substitute_decision` table, so there is nothing to load) -- the same
 * choke point every other recompute path routes through, which runs the
 * engine, stores the fresh readiness snapshot, and reconciles
 * `swap_suggestion` (pure inserts on this first pass, since nothing is
 * persisted yet to reconcile against).
 *
 * Structured the same way as `src/stores/variant-queue-worker.ts`: the
 * per-deck loop is exported as a plain function over injected
 * dependencies so it is unit-testable without booting a Nest context;
 * `main()` is the one piece that boots `NestFactory.createApplicationContext`
 * for this out-of-request-cycle, one-shot work.
 */

export interface IBackfillDeps {
  readonly trackedDeckRepo: Pick<Repository<TrackedDeckEntity>, 'find'>;
  readonly substitutionService: Pick<SubstitutionService, 'computeAndStoreReadiness'>;
  readonly logger: Pick<Logger, 'log' | 'warn'>;
}

export interface IBackfillSummary {
  readonly totalDecks: number;
  readonly succeeded: number;
  readonly failed: number;
}

export async function backfillSwapSuggestions(deps: IBackfillDeps): Promise<IBackfillSummary> {
  const decks = await deps.trackedDeckRepo.find({ select: ['id', 'userId'] });

  let succeeded = 0;
  let failed = 0;

  for (const deck of decks) {
    try {
      await deps.substitutionService.computeAndStoreReadiness(deck.id, deck.userId);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      deps.logger.warn({
        event: 'backfill-swap-suggestions.deck_failed',
        trackedDeckId: deck.id,
        error: (err as Error).message,
      });
    }
  }

  const summary: IBackfillSummary = { totalDecks: decks.length, succeeded, failed };
  deps.logger.log({ event: 'backfill-swap-suggestions.completed', ...summary });
  return summary;
}

async function main(): Promise<void> {
  const logger = new Logger('BackfillSwapSuggestions');
  // Imported dynamically so loading this module for unit tests does not pull
  // in AppModule's eager environment validation (same reasoning as
  // variant-queue-worker.ts).
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const trackedDeckRepo = app.get<Repository<TrackedDeckEntity>>(
    getRepositoryToken(TrackedDeckEntity),
  );
  const substitutionService = app.get(SubstitutionService);

  logger.log({ event: 'backfill-swap-suggestions.started' });
  await backfillSwapSuggestions({ trackedDeckRepo, substitutionService, logger });
  await app.close();
}

if (require.main === module) {
  void main();
}
