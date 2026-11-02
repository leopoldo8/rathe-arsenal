import { DataSource, QueryRunner } from 'typeorm';
import { AddPublicDecks1778533615000 } from '../1778533615000-AddPublicDecks';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const SCHEMA = 'add_public_decks_migration_test';

describe('AddPublicDecks1778533615000', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function tables(): Promise<string[]> {
    const rows: Array<{ table_name: string }> = await queryRunner.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA],
    );
    return rows.map((row) => row.table_name);
  }

  async function insertDeck(fabraryUlid: string): Promise<string> {
    const [{ id }] = await queryRunner.query(
      `INSERT INTO public_deck ("fabraryUlid", "heroIdentifier", format, "authorKey", "deckUpdatedAt", "fetchedAt")
       VALUES ($1, 'kayo-armed-and-dangerous', 'Living Legend', 'a', now(), now()) RETURNING id`,
      [fabraryUlid],
    );
    return id as string;
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL, schema: SCHEMA, synchronize: false });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.query(`CREATE SCHEMA "${SCHEMA}"`);
    await queryRunner.query(`SET search_path TO "${SCHEMA}", public`);
  });

  afterAll(async () => {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('up creates the three tables, runs again cleanly, and keeps one row per deck with bounded copies; down drops them', async () => {
    // Act
    await new AddPublicDecks1778533615000().up(queryRunner);
    await new AddPublicDecks1778533615000().up(queryRunner);

    // Assert
    expect(await tables()).toEqual(['public_deck', 'public_deck_card', 'public_deck_refresh']);
    const deckId = await insertDeck('01JPVB00000000000000000001');
    await expect(insertDeck('01JPVB00000000000000000001')).rejects.toThrow(/UQ_public_deck_fabrary_ulid/);
    await expect(
      queryRunner.query(`INSERT INTO public_deck_card ("publicDeckId", "cardIdentifier", quantity) VALUES ($1, 'berserk-yellow', 100)`, [deckId]),
    ).rejects.toThrow(/CHK_public_deck_card_quantity/);
    await queryRunner.query(`INSERT INTO public_deck_card ("publicDeckId", "cardIdentifier", quantity) VALUES ($1, 'berserk-yellow', 3)`, [deckId]);
    await queryRunner.query(`DELETE FROM public_deck WHERE id = $1`, [deckId]);
    expect(await queryRunner.query(`SELECT * FROM public_deck_card`)).toEqual([]);

    await new AddPublicDecks1778533615000().down(queryRunner);
    expect(await tables()).toEqual([]);
  });
});
