/**
 * The share report's visitor-action counts against the local Postgres: events recorded through the real routes are
 * counted by kind, intent and list kind, and `scripts/share-report.ts` prints those same rows.
 */
import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureHttpApp } from '../../http/configure-http-app';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';
import { countVisitorEvents, formatVisitorEventLines } from '../share-report-queries';

const PASSWORD = 'share-report-password-123';
const SUFFIX = Date.now().toString(36);
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';

describe('Share report queries (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let client: Client;
  let startedAt: Date;
  let sessionToken: string;
  let ownerId: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const asOwner = (req: request.Test): request.Test => req.set('Cookie', sessionCookieHeader(sessionToken));

  // `occurredAt` is stamped by the database clock. In Docker that clock can differ from this process's by more than the
  // few milliseconds between starting the test and recording its events, so the window is read from the database too.
  async function databaseNow(): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0]!.now;
  }

  async function shareList(kind: 'want' | 'sell'): Promise<string> {
    const list = await asOwner(request(server).post('/api/lists').send({ kind, name: `Report ${kind}` })).expect(201);
    const link = await asOwner(request(server).post(`/api/lists/${list.body.id as number}/share`).send({})).expect(201);
    return link.body.token as string;
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] = DATABASE_URL;
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    const email = `share-report-${SUFFIX}@test.local`;
    const signUp = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    sessionToken = sessionTokenOf(signUp);
    ownerId = signUp.body.user.id as string;
    await asOwner(request(server).patch('/api/users/me/display-name').send({ displayName: 'Rodrigo' })).expect(200);
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.query(`DELETE FROM "user" WHERE email = $1`, [`share-report-${SUFFIX}@test.local`]);
    await client?.end();
    await app?.close();
    jest.restoreAllMocks();
  });

  it('the report counts offer, quote_sent and buy by intent and list kind', async () => {
    startedAt = await databaseNow();
    const [deck] = (await dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Report deck', 'Some Hero', NULL, 'cc', 'building') RETURNING id`,
      [ownerId],
    )) as [{ id: number }];
    const quote = await asOwner(request(server).post(`/api/decks/${deck.id}/share`).send({ intent: 'quote' })).expect(201);
    const wantToken = await shareList('want');
    const sellToken = await shareList('sell');
    await request(server).post(`/api/shared/lists/${wantToken}/events`).send({ kind: 'offer' }).expect(204);
    await request(server).post(`/api/shared/lists/${sellToken}/events`).send({ kind: 'buy' }).expect(204);
    await request(server).post(`/api/shared/decks/${quote.body.token as string}/events`).send({ kind: 'quote_sent' }).expect(204);

    const rows = await countVisitorEvents(client, { since: startedAt, until: new Date((await databaseNow()).getTime() + 60_000) });

    expect(rows).toEqual([
      { kind: 'buy', intent: 'sell', listKind: 'sell', count: 1 },
      { kind: 'offer', intent: 'want', listKind: 'want', count: 1 },
      { kind: 'quote_sent', intent: 'quote', listKind: 'deck', count: 1 },
    ]);
  });

  it('the report script prints the rows of that same query', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const expected = formatVisitorEventLines(await countVisitorEvents(client, { since: dayStart, until: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) }));

    const output = execFileSync('pnpm', ['exec', 'tsx', 'scripts/share-report.ts', '--since', today, '--until', today], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL },
      encoding: 'utf8',
    });

    expect(expected.length).toBeGreaterThanOrEqual(3);
    for (const line of expected) expect(output).toContain(line);
  }, 60_000);
});
