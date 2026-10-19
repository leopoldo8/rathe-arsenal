import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

/**
 * Sharing success numbers (see .design/sharing.md), read straight from
 * `share_event` and `user`. Raw `pg` like purge-deleted-users.ts: no TypeORM boot for a report.
 *
 * Usage: pnpm share:report [--since YYYY-MM-DD] [--until YYYY-MM-DD]
 * `--until` is inclusive of that whole day. Without flags the whole history is counted.
 */

const DATE_FLAG = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

interface IPeriod {
  readonly since: Date;
  readonly until: Date;
}

function parseDateFlag(argv: readonly string[], name: string): Date | null {
  const prefix = `${name}=`;
  const index = argv.findIndex((arg) => arg === name || arg.startsWith(prefix));
  if (index === -1) return null;
  const raw = argv[index]?.startsWith(prefix) ? argv[index].slice(prefix.length) : argv[index + 1];
  if (!raw || !DATE_FLAG.test(raw) || Number.isNaN(Date.parse(raw))) {
    console.error(`Invalid ${name} value: expected YYYY-MM-DD`);
    process.exit(1);
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

function parsePeriod(argv: readonly string[]): IPeriod {
  const since = parseDateFlag(argv, '--since') ?? new Date(0);
  const untilDay = parseDateFlag(argv, '--until');
  const until = untilDay ? new Date(untilDay.getTime() + DAY_MS) : new Date(Date.now() + DAY_MS);
  return { since, until };
}

interface IKindRow {
  targetKind: string;
  createdBy: string;
  createdEvents: string;
  openedEvents: string;
  openedBy: string;
  signedUpEvents: string;
}

async function main(): Promise<void> {
  config({ path: resolve(__dirname, '..', '.env') });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }

  const { since, until } = parsePeriod(process.argv.slice(2));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const perKind = await client.query<IKindRow>(
      `SELECT "targetKind",
              COUNT(DISTINCT "ownerUserId") FILTER (WHERE kind = 'created') AS "createdBy",
              COUNT(*) FILTER (WHERE kind = 'created') AS "createdEvents",
              COUNT(*) FILTER (WHERE kind = 'opened') AS "openedEvents",
              COUNT(DISTINCT "actorUserId") FILTER (WHERE kind = 'opened') AS "openedBy",
              COUNT(*) FILTER (WHERE kind = 'signed_up') AS "signedUpEvents"
         FROM share_event
        WHERE "occurredAt" >= $1 AND "occurredAt" < $2
        GROUP BY "targetKind"
        ORDER BY "targetKind"`,
      [since, until],
    );

    const referred = await client.query<{ referredVia: string; users: string }>(
      `SELECT "referredVia", COUNT(*) AS users
         FROM "user"
        WHERE "referredByUserId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
        GROUP BY "referredVia"
        ORDER BY "referredVia"`,
      [since, until],
    );

    console.log(`Share report, ${since.toISOString()} to ${until.toISOString()} (end exclusive)`);
    if (perKind.rows.length === 0) console.log('No share events in the period.');
    for (const row of perKind.rows) {
      console.log(`\n[${row.targetKind}]`);
      console.log(`  users who shared:        ${row.createdBy} (${row.createdEvents} links created)`);
      console.log(`  opens:                   ${row.openedEvents} (${row.openedBy} distinct signed-in visitors)`);
      console.log(`  sign-ups via a link:     ${row.signedUpEvents}`);
    }

    console.log('\nUsers created with a referrer in the period');
    if (referred.rows.length === 0) console.log('  none');
    for (const row of referred.rows) console.log(`  via ${row.referredVia}: ${row.users}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[share-report] failed:', err);
  process.exit(1);
});
