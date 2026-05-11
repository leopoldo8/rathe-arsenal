import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * U1 (T+5000) — Backfills `tracked_deck.heroIdentifier` from the legacy
 * `tracked_deck.hero` display-name column using the engine catalog's byName index.
 *
 * PREREQUISITE: The engine package must be compiled before this migration can run
 * via the migration CLI. Run `pnpm --filter @rathe-arsenal/engine build` before
 * invoking `pnpm --filter @rathe-arsenal/api migration:run`. The CLI DataSource
 * (datasource.ts) loads from the compiled `dist/` output, which transitively
 * requires the engine package's compiled output.
 *
 * Approach (R24a):
 *   1. Fetch all rows where hero IS NOT NULL AND heroIdentifier IS NULL.
 *   2. For each row, look up the hero display name in catalog.indices.byName
 *      (case-insensitive) and filter to entries where types includes Type.Hero.
 *   3. If exactly one hero card matches → update the row with its cardIdentifier.
 *   4. If zero or multiple matches → log a Pino WARN and leave heroIdentifier = NULL.
 *      DO NOT THROW. Rationale: database.module.ts sets `migrationsRun: !isDev`,
 *      so a thrown migration aborts the NestJS boot in production — turning one
 *      unresolvable hero display-name into a hard outage. NULL heroIdentifier is
 *      handled gracefully by the legality engine (category='illegal' with the
 *      user-actionable reason "Hero not recognized — please re-select in Edit mode").
 *      The owner reviews warn logs after deploy and either edits the DB row or
 *      asks the user to re-select via Edit mode.
 *
 * Part of the 6-migration sequence for Deck Management v2 (Plan §U1).
 */
export class BackfillTrackedDeckHeroIdentifier1778533581000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Inline Pino-compatible logger: queryRunner doesn't have a logger injected,
    // so we use process.stdout JSON lines (matches the NestJS/Pino format at
    // info/warn levels). In test environments we suppress console output.
    const isTest =
      process.env['JEST_WORKER_ID'] !== undefined || process.env['NODE_ENV'] === 'test';

    const warn = (msg: string, extra?: Record<string, unknown>): void => {
      if (isTest) return;
      console.warn(JSON.stringify({ level: 'warn', msg, migration: 'BackfillTrackedDeckHeroIdentifier', ...extra }));
    };

    // 1. Lazily import the catalog (engine must be compiled — see PREREQUISITE above).
    let catalog: import('@rathe-arsenal/engine').ICatalog;
    let Type: typeof import('@rathe-arsenal/engine').Type;

    try {
      const engine = await import('@rathe-arsenal/engine');
      catalog = engine.catalog;
      Type = engine.Type;
    } catch (err) {
      // If the engine is not built, we cannot backfill. Log a warning and abort
      // the backfill step gracefully — do NOT throw, to preserve boot safety.
      warn('Engine catalog unavailable — skipping heroIdentifier backfill. Run: pnpm --filter @rathe-arsenal/engine build', {
        error: (err as Error).message,
      });
      return;
    }

    // 2. Fetch all rows that need backfilling.
    const rows: Array<{ id: number; hero: string }> = await queryRunner.query(`
      SELECT "id", "hero"
      FROM "tracked_deck"
      WHERE "hero" IS NOT NULL
        AND "heroIdentifier" IS NULL
    `);

    if (rows.length === 0) {
      return;
    }

    let resolved = 0;
    let skipped = 0;

    for (const row of rows) {
      const heroName = row.hero.trim().toLowerCase();
      const candidates = catalog.indices.byName.get(heroName) ?? [];

      // Filter to cards with Type.Hero to disambiguate from cards sharing a
      // display name with a non-hero card (rare but possible in the FAB data).
      const heroCards = candidates.filter((c) => c.types.includes(Type.Hero));

      if (heroCards.length === 1) {
        const heroIdentifier = heroCards[0]!.cardIdentifier;
        await queryRunner.query(
          `UPDATE "tracked_deck" SET "heroIdentifier" = $1 WHERE "id" = $2`,
          [heroIdentifier, row.id],
        );
        resolved++;
      } else {
        // Zero or multiple matches — log and skip. The legality engine handles
        // NULL heroIdentifier gracefully (category='illegal').
        warn('heroIdentifier backfill: unresolved hero display name', {
          trackedDeckId: row.id,
          heroName: row.hero,
          candidateCount: heroCards.length,
          action: 'heroIdentifier left NULL — user must re-select in Edit mode',
        });
        skipped++;
      }
    }

    if (!isTest) {
      console.log(JSON.stringify({
        level: 'info',
        msg: 'heroIdentifier backfill complete',
        migration: 'BackfillTrackedDeckHeroIdentifier',
        totalRows: rows.length,
        resolved,
        skipped,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the backfill: clear all heroIdentifier values that were set from
    // the hero display-name. We cannot tell which were pre-existing from new
    // Fabrary imports, so we null out all of them. The T+1000 migration drops
    // the column when rolled back further.
    await queryRunner.query(`
      UPDATE "tracked_deck"
      SET "heroIdentifier" = NULL
      WHERE "heroIdentifier" IS NOT NULL
    `);
  }
}
