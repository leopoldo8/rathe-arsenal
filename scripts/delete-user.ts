import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

/**
 * Phase 0 operator escape hatch — hard-deletes a single user and all
 * their linked rows on demand (bypasses the 30-day retention window
 * that `purge-deleted-users.ts` enforces for soft-deleted accounts).
 *
 * Uses the raw `pg` driver rather than TypeORM for the same reason
 * `purge-deleted-users.ts` does: loading TypeORM entities under tsx
 * triggers a decorator-emit incompatibility with esbuild. Raw SQL is
 * faster to boot and easier to audit.
 *
 * Cascade order (children first, parents last — matches
 * `purge-deleted-users.ts`):
 *   rejected_substitute →
 *   deck_readiness_snapshot →
 *   deck_card →
 *   tracked_deck →
 *   collection_card →
 *   user
 */

const USAGE = 'Usage: pnpm tsx scripts/delete-user.ts <userId>';

async function main(): Promise<void> {
  // Load env from the repo root .env — this workspace keeps all runtime
  // configuration at the root, shared across api/web/scripts.
  config({ path: resolve(__dirname, '..', '.env') });

  const userId = process.argv[2];
  if (!userId) {
    console.error(USAGE);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database.');
  } catch (err) {
    console.error('Could not connect to database:', err);
    process.exit(1);
  }

  try {
    // Verify the user exists before the delete cascade so we can give
    // a clean "not found" exit rather than a silent zero-row transaction.
    const userRes = await client.query<{ id: string }>(
      'SELECT id FROM "user" WHERE id = $1',
      [userId],
    );
    if (userRes.rowCount === 0) {
      console.error(`\nUser ${userId} not found in the database.`);
      process.exit(1);
    }

    // Count rows per table so the operator sees what will be deleted
    // before the transaction commits.
    const trackedDeckRes = await client.query<{ id: string }>(
      'SELECT id FROM "tracked_deck" WHERE "userId" = $1',
      [userId],
    );
    const trackedDeckIds = trackedDeckRes.rows.map((r) => r.id);

    const rejectedSubstituteCount = trackedDeckIds.length
      ? (
          await client.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM "rejected_substitute" WHERE "trackedDeckId" = ANY($1::uuid[])',
            [trackedDeckIds],
          )
        ).rows[0]?.count ?? '0'
      : '0';

    const snapshotCount = trackedDeckIds.length
      ? (
          await client.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM "deck_readiness_snapshot" WHERE "trackedDeckId" = ANY($1::uuid[])',
            [trackedDeckIds],
          )
        ).rows[0]?.count ?? '0'
      : '0';

    const deckCardCount = trackedDeckIds.length
      ? (
          await client.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM "deck_card" WHERE "trackedDeckId" = ANY($1::uuid[])',
            [trackedDeckIds],
          )
        ).rows[0]?.count ?? '0'
      : '0';

    const collectionCardCount =
      (
        await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM "collection_card" WHERE "userId" = $1',
          [userId],
        )
      ).rows[0]?.count ?? '0';

    console.log(`\nRows to delete for user ${userId}:`);
    console.log(`  rejected_substitute:     ${rejectedSubstituteCount}`);
    console.log(`  deck_readiness_snapshot: ${snapshotCount}`);
    console.log(`  deck_card:               ${deckCardCount}`);
    console.log(`  collection_card:         ${collectionCardCount}`);
    console.log(`  tracked_deck:            ${trackedDeckIds.length}`);
    console.log(`  user:                    1`);

    await client.query('BEGIN');
    try {
      if (trackedDeckIds.length > 0) {
        await client.query(
          'DELETE FROM "rejected_substitute" WHERE "trackedDeckId" = ANY($1::uuid[])',
          [trackedDeckIds],
        );
        await client.query(
          'DELETE FROM "deck_readiness_snapshot" WHERE "trackedDeckId" = ANY($1::uuid[])',
          [trackedDeckIds],
        );
        await client.query(
          'DELETE FROM "deck_card" WHERE "trackedDeckId" = ANY($1::uuid[])',
          [trackedDeckIds],
        );
      }

      await client.query('DELETE FROM "tracked_deck" WHERE "userId" = $1', [
        userId,
      ]);
      await client.query('DELETE FROM "collection_card" WHERE "userId" = $1', [
        userId,
      ]);
      await client.query('DELETE FROM "user" WHERE id = $1', [userId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log(`\nUser ${userId} and all related data deleted successfully.`);
    console.log(
      '\nReminder: The user has been removed from the database. ' +
        'No external services need cleanup (DIY auth, no Clerk).',
    );
  } catch (err) {
    console.error('Error during deletion:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
