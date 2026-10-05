import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { SourcesService } from '../sources/sources.service';

const CONCURRENT_CALLS = 30;
const MANUAL_INDEX = 'IDX_csv_source_user_manual_uq';

describe('manual source under concurrency (E2E)', () => {
  let dataSource: DataSource;
  let sources: SourcesService;
  let close: () => Promise<void>;
  const email = `manual-source-${Date.now().toString(36)}@test.local`;
  let userId: string;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    sources = moduleRef.get(SourcesService, { strict: false });
    const [row] = await dataSource.query(
      `INSERT INTO "user" (email, "passwordHash", "emailVerifiedAt") VALUES ($1, 'x', now()) RETURNING id`,
      [email],
    );
    userId = row.id as string;
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.query(`DELETE FROM "user" WHERE email = $1`, [email]);
    await close?.();
  });

  it('keeps the one-manual-source-per-user rule in the schema the app runs on', async () => {
    const rows: Array<{ indexdef: string }> = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'csv_source' AND indexname = $1`,
      [MANUAL_INDEX],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toMatch(/UNIQUE/);
    expect(rows[0]!.indexdef).toMatch(/kind\)?::text\s*=\s*'manual'/);
  });

  it('creates one manual source for a fresh user however many callers race', async () => {
    const results = await Promise.all(Array.from({ length: CONCURRENT_CALLS }, () => sources.ensureManualSource(userId)));

    const rows: Array<{ id: string }> = await dataSource.query(
      `SELECT id FROM csv_source WHERE "userId" = $1 AND kind = 'manual'`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(new Set(results.map((source) => source.id))).toEqual(new Set([rows[0]!.id]));
  });
});
