import { config } from 'dotenv';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { Client } from 'pg';

/**
 * Phase 1a Unit 2 (A8) — LGPD-compliant 30-day purge. Permanently removes
 * users whose `deletedAt` is older than the retention window along with all
 * their linked rows. Runs under a single transaction so partial failures
 * roll back cleanly.
 *
 * Intentionally uses the raw `pg` driver rather than TypeORM: a cron script
 * does not need the decorator runtime + entity metadata + reflect-metadata
 * bootstrap, and loading the full TypeORM stack under tsx triggers a
 * decorator-emit incompatibility with esbuild (see
 * https://github.com/privatenumber/tsx/issues). Raw SQL is faster to boot,
 * easier to audit, and keeps cron memory pressure lower.
 *
 * Flags:
 *   --dry-run       print the userIds that would be deleted without touching
 *                   the database
 *   --days=<n>      override the 30-day retention window (default 30)
 *   --yes           skip the interactive confirmation prompt (for cron use)
 *
 * The script is safe to run under Railway cron (`--yes` skips the prompt,
 * `process.stdin.isTTY` is false under cron). In a terminal, it prompts for
 * y/N confirmation before touching any rows.
 *
 * Cascade order (children first, parents last — matches `delete-user.ts`):
 *   rejected_substitute →
 *   deck_readiness_snapshot →
 *   deck_card →
 *   tracked_deck →
 *   collection_card →
 *   user
 */

const DEFAULT_RETENTION_DAYS = 30;

interface IParsedFlags {
  dryRun: boolean;
  days: number;
  yes: boolean;
}

function parseFlags(argv: readonly string[]): IParsedFlags {
  const flags: IParsedFlags = {
    dryRun: false,
    days: DEFAULT_RETENTION_DAYS,
    yes: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg.startsWith('--days=')) {
      const raw = Number(arg.slice('--days='.length));
      // Require a positive integer. Rejecting 0 specifically closes the
      // footgun where `--days=0 --yes` would set `cutoff ≈ now` and purge
      // every soft-deleted user immediately — a mistyped flag should not
      // short-circuit the 30-day LGPD retention window.
      if (!Number.isInteger(raw) || raw < 1) {
        console.error(
          `Invalid --days value: ${arg} (must be a positive integer >= 1)`,
        );
        process.exit(1);
      }
      flags.days = raw;
    }
  }
  return flags;
}

async function promptYesNo(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((res) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      res(normalized === 'y' || normalized === 'yes');
    });
  });
}

async function main(): Promise<void> {
  // Load env from the repo root .env — this workspace keeps all runtime
  // configuration at the root, shared across api/web/scripts.
  config({ path: resolve(__dirname, '..', '.env') });

  const flags = parseFlags(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - flags.days * 24 * 60 * 60 * 1000);

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log(
      `[purge] Connected. Retention window: ${flags.days} days (cutoff: ${cutoff.toISOString()}).`,
    );
  } catch (err) {
    console.error('[purge] Could not connect to database:', err);
    process.exit(1);
  }

  try {
    // Postgres `NULL < cutoff` evaluates to NULL (falsy), so the simple
    // comparison correctly excludes users who have never been soft-deleted.
    const eligible = await client.query<{ id: string; deletedAt: Date }>(
      'SELECT id, "deletedAt" FROM "user" WHERE "deletedAt" < $1 ORDER BY "deletedAt" ASC',
      [cutoff],
    );

    if (eligible.rowCount === 0) {
      console.log('[purge] No users older than the retention window. Nothing to do.');
      return;
    }

    console.log(`[purge] ${eligible.rowCount} user(s) eligible for purge:`);
    for (const row of eligible.rows) {
      console.log(`  userId=${row.id} deletedAt=${row.deletedAt.toISOString()}`);
    }

    if (flags.dryRun) {
      console.log('[purge] --dry-run: no rows touched.');
      return;
    }

    // Confirmation gate: cron runs under --yes; interactive runs prompt.
    if (!flags.yes && process.stdin.isTTY) {
      const ok = await promptYesNo(
        `Delete ${eligible.rowCount} user(s) and all linked rows?`,
      );
      if (!ok) {
        console.log('[purge] Aborted by user.');
        return;
      }
    }

    const userIds = eligible.rows.map((r) => r.id);

    await client.query('BEGIN');
    try {
      // rejected_substitute is scoped per trackedDeck; cascade through the
      // user's tracked decks explicitly so we do not rely on ON DELETE
      // CASCADE for the whole chain (defense in depth).
      await client.query(
        `DELETE FROM "rejected_substitute"
         WHERE "trackedDeckId" IN (
           SELECT id FROM "tracked_deck" WHERE "userId" = ANY($1::uuid[])
         )`,
        [userIds],
      );

      await client.query(
        `DELETE FROM "deck_readiness_snapshot"
         WHERE "trackedDeckId" IN (
           SELECT id FROM "tracked_deck" WHERE "userId" = ANY($1::uuid[])
         )`,
        [userIds],
      );

      await client.query(
        `DELETE FROM "deck_card"
         WHERE "trackedDeckId" IN (
           SELECT id FROM "tracked_deck" WHERE "userId" = ANY($1::uuid[])
         )`,
        [userIds],
      );

      await client.query(`DELETE FROM "tracked_deck" WHERE "userId" = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM "collection_card" WHERE "userId" = ANY($1::uuid[])`, [userIds]);

      // Structured log EVERY userId before the final delete commits. Keeps
      // an operator trail in Railway logs beyond Postgres's own audit.
      for (const id of userIds) {
        console.log(
          JSON.stringify({
            event: 'purge.user.delete',
            userId: id,
            cutoff: cutoff.toISOString(),
            at: new Date().toISOString(),
          }),
        );
      }

      await client.query(`DELETE FROM "user" WHERE id = ANY($1::uuid[])`, [userIds]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log(`[purge] Successfully purged ${userIds.length} user(s).`);
  } catch (err) {
    console.error('[purge] FAILED:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
