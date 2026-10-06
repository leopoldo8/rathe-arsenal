import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from '..';
import { RECOMMENDATION_COLUMNS, readRecommendationColumns } from '../../migrations/__tests__/recommendation-columns';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs';
const SCHEMA = 'recommendation_entities_test';

describe('recommendation entities', () => {
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

  it('synchronize builds the same columns as the migration', async () => {
    expect(await readRecommendationColumns(dataSource, SCHEMA)).toEqual(RECOMMENDATION_COLUMNS);
  });
});
