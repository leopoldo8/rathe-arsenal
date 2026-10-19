import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';
import {
  PURGE_USAGE,
  PurgeUsageError,
  buildPurgeStatements,
  parsePurgeArgs,
  type TPurgePlan,
} from '../apps/api/src/sharing/preview/purge-plan';

/**
 * Takedown for generated share images (docs/research/ip-posture.md, rule 5).
 *   --all               deletes every stored image; new ones are drawn on the next request
 *   --card <id> [...]   blocks those cards (never drawn again) and deletes the images that show them
 * Needs no deploy: the image route renders again on the next request.
 */
async function main(): Promise<void> {
  config({ path: resolve(__dirname, '..', '.env') });

  let plan: TPurgePlan;
  try {
    plan = parsePurgeArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof PurgeUsageError)) throw error;
    console.error(`${error.message}\n${PURGE_USAGE}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const statement of buildPurgeStatements(plan)) {
      const result = await client.query(statement.sql, [...statement.params]);
      console.log(`[share-images:purge] ${statement.sql.split(' ').slice(0, 3).join(' ')}: ${result.rowCount} row(s)`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[share-images:purge] failed:', error);
  process.exit(1);
});
