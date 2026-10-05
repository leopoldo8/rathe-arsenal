/**
 * Shared real-Postgres fixture for the card-alternatives e2e specs. Each
 * scenario signs up its own user and imports its own deck, because a pick
 * rewrites `deck_card` and so a deck cannot be shared across tests.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { IDeckCardEntry, IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { FabraryService } from '../../fabrary/fabrary.service';

export const KATSU = 'katsu-the-wanderer';
export const TALISHAR = 'talishar-the-lost-prince';
export const EMISSARY = 'emissary-of-tides-red';
export const FLEX = 'flex-red';
export const COAX = 'coax-a-commotion-red';
export const ADRENALINE = 'adrenaline-rush-red';
export const PASSWORD = 'replacements-e2e-password-123';

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newUlid(): string {
  const tail = Array.from({ length: 22 }, () => ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)]);
  return `01HP${tail.join('')}`;
}

export function baseDeck(extraMainboard: readonly IDeckCardEntry[] = []): Omit<IDeckImportDto, 'ulid'> {
  return {
    name: 'Replacements e2e deck',
    format: 'Classic Constructed',
    hero: { cardIdentifier: KATSU, name: 'Katsu, the Wanderer' },
    mainboard: [
      { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
      { cardIdentifier: FLEX, quantity: 2, slot: 'mainboard' },
      ...extraMainboard,
    ],
    equipment: [],
    weapons: [{ cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' }],
    inventory: [],
  };
}

export function mainboard(cardIdentifier: string, quantity: number): IDeckCardEntry {
  return { cardIdentifier, quantity, slot: 'mainboard' };
}

export interface IScenario {
  readonly jwt: string;
  readonly deckId: number;
  readonly email: string;
}

export interface IFixture {
  readonly app: INestApplication;
  readonly dataSource: DataSource;
  /** Signs up a user and imports a deck for them. */
  scenario(extraMainboard?: readonly IDeckCardEntry[]): Promise<IScenario>;
  signUp(label: string): Promise<{ readonly jwt: string; readonly email: string }>;
  get(path: string, jwt: string): request.Test;
  post(path: string, jwt: string): request.Test;
  put(path: string, jwt: string): request.Test;
  own(jwt: string, items: readonly { cardIdentifier: string; quantity: number }[]): Promise<void>;
  deckCards(deckId: number): Promise<Record<string, number>>;
  replacementRows(deckId: number): Promise<Array<Record<string, unknown>>>;
  swapRows(deckId: number): Promise<Array<Record<string, unknown>>>;
  latestBreakdown(deckId: number): Promise<{
    exact: Array<{ cardIdentifier: string; quantity: number }>;
    substituted: Array<{ original: { cardIdentifier: string; quantity: number }; match: { substitute: { cardIdentifier: string } } }>;
    missing: Array<{ cardIdentifier: string; quantity: number }>;
  }>;
  snapshotCount(deckId: number): Promise<number>;
  close(): Promise<void>;
}

export async function bootFixture(options: { readonly throttle?: boolean } = {}): Promise<IFixture> {
  process.env['NODE_ENV'] = 'development';
  process.env['DATABASE_URL'] =
    process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
  process.env['JWT_EXPIRES_IN'] = '1d';
  process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
  process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
  process.env['APP_BASE_URL'] = 'http://localhost:5173';
  process.env['PORT'] = '0';

  const decks = new Map<string, Omit<IDeckImportDto, 'ulid'>>();
  const fabrary = createMock<FabraryService>();
  fabrary.fetchDeck.mockImplementation(async (ulid: string) => ({ ulid, ...(decks.get(ulid) ?? baseDeck()) }));

  const throttlerGuard = (await import('@nestjs/throttler')).ThrottlerGuard;
  const stub = options.throttle ? null : jest.spyOn(throttlerGuard.prototype, 'canActivate').mockResolvedValue(true);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FabraryService)
    .useValue(fabrary)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Listening once on loopback, as the scanner throttle spec does, keeps supertest from opening and
  // closing a server per request: over the 600 requests of a throttle run that showed ECONNRESET.
  await app.listen(0, '127.0.0.1');
  const dataSource = moduleRef.get<DataSource>(getDataSourceToken());

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const emails: string[] = [];
  const server = app.getHttpServer();
  const auth = (jwt: string) => `Bearer ${jwt}`;

  const signUp = async (label: string): Promise<{ jwt: string; email: string }> => {
    const email = `repl-${label}-${suffix}-${emails.length}@test.local`;
    emails.push(email);
    const created = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(202);
    const token = new URL(created.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    return { jwt: signIn.body.jwt as string, email };
  };

  const fixture: IFixture = {
    app,
    dataSource,
    signUp,
    get: (path, jwt) => request(server).get(path).set('Authorization', auth(jwt)),
    post: (path, jwt) => request(server).post(path).set('Authorization', auth(jwt)),
    put: (path, jwt) => request(server).put(path).set('Authorization', auth(jwt)),
    async scenario(extraMainboard = []) {
      const user = await signUp('owner');
      const ulid = newUlid();
      decks.set(ulid, baseDeck(extraMainboard));
      const imported = await request(server)
        .post('/api/decks/import')
        .set('Authorization', auth(user.jwt))
        .send({ urls: [`https://fabrary.net/decks/${ulid}`], seedInventory: false })
        .expect(201);
      return { ...user, deckId: imported.body.imported[0].trackedDeckId as number };
    },
    async own(jwt, items) {
      await request(server)
        .post('/api/collection/cards/batch')
        .set('Authorization', auth(jwt))
        .send({ items })
        .expect(201);
    },
    async deckCards(deckId) {
      const rows: Array<{ cardIdentifier: string; slot: string; quantity: number }> = await dataSource.query(
        `SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`,
        [deckId],
      );
      return Object.fromEntries(rows.map((row) => [`${row.cardIdentifier}@${row.slot}`, row.quantity]));
    },
    replacementRows: (deckId) =>
      dataSource.query(`SELECT * FROM card_replacement WHERE "trackedDeckId" = $1 ORDER BY "createdAt", id`, [deckId]),
    swapRows: (deckId) =>
      dataSource.query(`SELECT * FROM swap_suggestion WHERE "trackedDeckId" = $1 ORDER BY id`, [deckId]),
    async latestBreakdown(deckId) {
      const rows = await dataSource.query(
        `SELECT breakdown FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1 ORDER BY "computedAt" DESC, id DESC LIMIT 1`,
        [deckId],
      );
      return rows[0].breakdown;
    },
    async snapshotCount(deckId) {
      const rows = await dataSource.query(
        `SELECT count(*)::int AS count FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1`,
        [deckId],
      );
      return rows[0].count;
    },
    async close() {
      if (dataSource.isInitialized) {
        await dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [emails]);
      }
      await app.close();
      stub?.mockRestore();
    },
  };
  return fixture;
}

/** The body of an error response without its timestamp, for same-body comparisons. */
export function withoutTimestamp(body: Record<string, unknown>): Record<string, unknown> {
  const { timestamp: _timestamp, ...rest } = body;
  return rest;
}
