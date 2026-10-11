/**
 * DB-backed test for DropSwapSuggestion1778533593000 (swaps-into-alternatives
 * doors 1 and 4), in its own schema so it never touches the synchronize-managed
 * public schema; one QueryRunner holds a single connection so `SET search_path`
 * applies to every statement.
 */
import { DataSource, QueryRunner } from 'typeorm';
import { AddCardReplacement1778533590000 } from '../1778533590000-AddCardReplacement';
import { ReplaceSubstituteDecisionWithSwapSuggestion1778533586000 } from '../1778533586000-ReplaceSubstituteDecisionWithSwapSuggestion';
import { DropSwapSuggestion1778533593000 } from '../1778533593000-DropSwapSuggestion';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'drop_swap_suggestion_migration_test';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const ORIGINS = ['very_close', 'close', 'other_pitch', 'generic', 'search', 'recommendation', 'suggested'] as const;

describe('DropSwapSuggestion1778533593000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function count(table: string): Promise<number> {
    const [{ total }] = (await queryRunner.query(`SELECT count(*)::int AS total FROM "${table}"`)) as [
      { total: number },
    ];
    return total;
  }

  async function insertSwap(cardIdentifier: string, status: string): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "swap_suggestion"
         ("userId", "trackedDeckId", "cardIdentifier", slot, "substituteIdentifier", quantity, tier, confidence, rationale, status)
       VALUES ($1, 1, $2, 'mainboard', 'stand-in', 1, 1, 0.9, 'same profile', $3)`,
      [USER_ID, cardIdentifier, status],
    );
  }

  async function insertReplacement(pickedFrom: string): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "card_replacement"
         ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
       VALUES ($1, 1, 'mainboard', 'emissary-of-tides-red', 'coax-a-commotion-red', 1, $2, 'active')`,
      [USER_ID, pickedFrom],
    );
  }

  async function accepts(pickedFrom: string): Promise<boolean> {
    await queryRunner.startTransaction();
    try {
      await insertReplacement(pickedFrom);
      return true;
    } catch {
      return false;
    } finally {
      await queryRunner.rollbackTransaction();
    }
  }

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
    await queryRunner.query(`CREATE TABLE "user" (id uuid PRIMARY KEY)`);
    await queryRunner.query(`CREATE TABLE "tracked_deck" (id serial PRIMARY KEY)`);
    await queryRunner.query(
      `CREATE TABLE "deck_readiness_snapshot" (id serial PRIMARY KEY, "trackedDeckId" int NOT NULL, "effectivePercent" float NOT NULL)`,
    );
    await queryRunner.query(`INSERT INTO "user" (id) VALUES ($1)`, [USER_ID]);
    await queryRunner.query(`INSERT INTO "tracked_deck" (id) VALUES (1)`);
    await new ReplaceSubstituteDecisionWithSwapSuggestion1778533586000().up(queryRunner);
    await new AddCardReplacement1778533590000().up(queryRunner);
    await queryRunner.query(`ALTER TABLE "card_replacement" DROP CONSTRAINT "CHK_card_replacement_picked_from_valid"`);
    await queryRunner.query(
      `ALTER TABLE "card_replacement" ADD CONSTRAINT "CHK_card_replacement_picked_from_valid"
         CHECK ("pickedFrom" IN ('very_close', 'close', 'other_pitch', 'generic', 'search', 'recommendation'))`,
    );
  });

  afterEach(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('drops the swap table and empties the snapshots', async () => {
    await insertSwap('approved-card', 'approved');
    await insertSwap('pending-card', 'pending');
    await queryRunner.query(
      `INSERT INTO "deck_readiness_snapshot" ("trackedDeckId", "effectivePercent") VALUES (1, 80), (1, 90)`,
    );
    expect(await count('swap_suggestion')).toBe(2);
    expect(await count('deck_readiness_snapshot')).toBe(2);

    await new DropSwapSuggestion1778533593000().up(queryRunner);

    expect(await queryRunner.hasTable('swap_suggestion')).toBe(false);
    expect(await count('deck_readiness_snapshot')).toBe(0);

    await new DropSwapSuggestion1778533593000().down(queryRunner);

    expect(await queryRunner.hasTable('swap_suggestion')).toBe(true);
    expect(await count('swap_suggestion')).toBe(0);
  });

  it('accepts suggested as a replacement origin', async () => {
    expect(await accepts('suggested')).toBe(false);

    await new DropSwapSuggestion1778533593000().up(queryRunner);

    const results: Record<string, boolean> = {};
    for (const origin of ORIGINS) results[origin] = await accepts(origin);
    expect(results).toEqual(Object.fromEntries(ORIGINS.map((origin) => [origin, true])));
    expect(await accepts('swap')).toBe(false);

    await new DropSwapSuggestion1778533593000().down(queryRunner);

    expect(await accepts('suggested')).toBe(false);
    expect(await accepts('recommendation')).toBe(true);
  });
});
