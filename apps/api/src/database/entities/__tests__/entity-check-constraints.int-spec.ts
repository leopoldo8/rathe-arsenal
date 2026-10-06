/**
 * The CHECK constraints the migrations create are declared on their entities
 * too, so a schema TypeORM `synchronize` builds from the entities (local dev,
 * the e2e database) has them. Builds that schema in its own Postgres schema and
 * proves each of the eight exists by name and rejects a violating row.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from '..';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'entity_checks_test';
const ID = '33333333-3333-3333-3333-333333333333';

const SWAP_BASE = {
  userId: ID,
  trackedDeckId: 1,
  cardIdentifier: 'a',
  slot: 'mainboard',
  substituteIdentifier: 'b',
  quantity: 1,
  tier: 1,
  confidence: 90,
  rationale: 'r',
  status: 'pending',
};
const REPLACEMENT_BASE = {
  userId: ID,
  trackedDeckId: 1,
  slot: 'mainboard',
  originalCardIdentifier: 'a',
  replacementCardIdentifier: 'b',
  quantity: 1,
  pickedFrom: 'close',
  status: 'active',
};

const CASES: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
  ['csv_source', 'CHK_csv_source_kind_valid', { userId: ID, kind: 'bad' }],
  ['tracked_deck', 'CHK_tracked_deck_status_valid', { userId: ID, name: 'n', hero: 'h', format: 'f', status: 'bad' }],
  ['swap_suggestion', 'CHK_swap_suggestion_status_valid', { ...SWAP_BASE, status: 'bad' }],
  ['swap_suggestion', 'CHK_swap_suggestion_rejection_reason_valid', { ...SWAP_BASE, rejectionReason: 'bad' }],
  ['swap_suggestion', 'CHK_swap_suggestion_outcome_valid', { ...SWAP_BASE, outcome: 'bad' }],
  ['card_replacement', 'CHK_card_replacement_status_valid', { ...REPLACEMENT_BASE, status: 'open' }],
  ['card_replacement', 'CHK_card_replacement_picked_from_valid', { ...REPLACEMENT_BASE, pickedFrom: 'other' }],
  ['card_replacement', 'CHK_card_replacement_quantity_positive', { ...REPLACEMENT_BASE, quantity: 0 }],
];

describe('CHECK constraints declared on the entities', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const root = new DataSource({ type: 'postgres', url: DATABASE_URL });
    await root.initialize();
    await root.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await root.query(`CREATE SCHEMA "${SCHEMA}"`);
    await root.destroy();

    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      schema: SCHEMA,
      entities: Object.values(entities).filter((value) => typeof value === 'function') as never[],
      synchronize: true,
    });
    await dataSource.initialize();
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await dataSource.destroy();
    }
  });

  it.each(CASES)('%s: %s exists and rejects a violating row', async (table, constraint, row) => {
    const found: Array<{ conname: string }> = await dataSource.query(
      `SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1 AND t.relname = $2 AND c.conname = $3 AND c.contype = 'c'`,
      [SCHEMA, table, constraint],
    );
    expect(found).toHaveLength(1);

    const columns = Object.keys(row).map((column) => `"${column}"`).join(', ');
    const params = Object.values(row).map((_, index) => `$${index + 1}`).join(', ');
    // CHECKs are evaluated before the foreign keys, so the violation surfaces without parent rows. The schema is
    // explicit: unqualified, the insert resolves to public's migration-built table, not the one built from the entities.
    await expect(
      dataSource.query(`INSERT INTO "${SCHEMA}"."${table}" (${columns}) VALUES (${params})`, Object.values(row)),
    ).rejects.toMatchObject({ constraint });
  });

  it('card_replacement: the entity names its index as the migration does, with the same columns and widths', async () => {
    const indexes: Array<{ indexdef: string }> = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'IDX_card_replacement_deck_status'`,
      [SCHEMA],
    );
    expect(indexes).toHaveLength(1);
    expect(indexes[0]!.indexdef).toMatch(/\("trackedDeckId", status\)/);

    const widths: Array<{ column_name: string; character_maximum_length: number }> = await dataSource.query(
      `SELECT column_name, character_maximum_length FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'card_replacement' AND character_maximum_length IS NOT NULL`,
      [SCHEMA],
    );
    expect(Object.fromEntries(widths.map((row) => [row.column_name, row.character_maximum_length]))).toEqual({
      slot: 64,
      originalCardIdentifier: 128,
      replacementCardIdentifier: 128,
      pickedFrom: 32,
      status: 32,
    });
  });
});
