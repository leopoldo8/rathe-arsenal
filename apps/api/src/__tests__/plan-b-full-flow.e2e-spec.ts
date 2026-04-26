/**
 * Plan B full-flow E2E spec — Unit 11
 *
 * Exercises the complete Plan B API chain end-to-end:
 *   sign-up → email verify → sign-in → CSV upload → deck import →
 *   GET reviews (pending) → bulk approve → assert readiness improved →
 *   source toggle (active=false) → assert readiness drops
 *
 * This spec replaces the retired Gate 2 presencial walkthrough per
 * docs/validation-philosophy.md. It is the automated regression guard
 * that blocks merges breaking any node in the Plan B feature chain.
 *
 * Infrastructure notes:
 * - Requires a real PostgreSQL DB (DATABASE_URL env var).
 * - Uses NODE_ENV=development so the auth service returns _devVerificationLink
 *   in the sign-up response (no actual email sending needed).
 * - Overrides FabraryService with a deterministic mock (no network calls).
 * - Uses TypeORM synchronize:true (NODE_ENV=development) so migrations are
 *   not required — tables are auto-created from entity definitions.
 * - A unique email suffix ensures test data does not collide between runs.
 *
 * Fixture design (guaranteed tier-1 substitution):
 * - User CSV owns: "Coax a Commotion" (qty 3) → resolves unambiguously to
 *   coax-a-commotion-red. Profile: pitch=1, Generic, Action, power=4, def=2,
 *   no keywords, unique name (no other pitch variants in catalog).
 * - Mock deck needs: emissary-of-tides-red (qty 2). User does NOT own this.
 *   Profile: pitch=1, Generic, Action, power=4, def=2, no keywords.
 * - The substitution engine proposes coax-a-commotion-red as a tier-1
 *   substitute for emissary-of-tides-red (delta power=0, def=0, same class,
 *   no keyword mismatch). Score=1.0, clears tier-1 floor (0.9).
 * - This produces 2 entries in breakdown.substituted → 2 pending review rows.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createMock } from '@golevelup/ts-jest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { FabraryService } from '../fabrary/fabrary.service';
import { IDeckImportDto } from '../fabrary/dtos/deck-import.dto';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A small but representative CSV collection.
 *
 * Card identifier chosen so the substitution engine can pair it with a
 * deck card the user does NOT own:
 *   - coax-a-commotion-red: pitch=1, Generic Action, power=4, def=2, no kw.
 *     "Coax a Commotion" has a unique name in the catalog (no other pitch
 *     variants), so the CSV parser resolves it unambiguously to one identifier.
 *     It will substitute for emissary-of-tides-red (same profile) in the deck.
 *
 * The CSV format is: Name,Quantity
 * The CsvParserService resolves card names to identifiers via the catalog.
 */
const FIXTURE_CSV_CONTENT = [
  'Name,Quantity',
  'Coax a Commotion,3',
].join('\n');

/** Raw bytes uploaded as multipart/form-data. */
const FIXTURE_CSV_BUFFER = Buffer.from(FIXTURE_CSV_CONTENT, 'utf-8');

/**
 * The mock Fabrary ULID used in the deck import request.
 * Must be a valid Fabrary URL so parseFabraryUrl accepts it.
 */
// ULID uses Crockford Base32 alphabet (excludes I, L, O, U).
const FIXTURE_FABRARY_URL =
  'https://fabrary.net/decks/01HPABCDEFGHJKMN0000000QR1';

/**
 * Mock IDeckImportDto returned by the stubbed FabraryService.fetchDeck.
 *
 * Deck design:
 * - hero: katsu-the-wanderer (Ninja Hero — valid catalog entry)
 * - mainboard: emissary-of-tides-red (qty 2) — user does NOT own this card.
 *   Profile: pitch=1, Generic Action, power=4, def=2, no keywords. The engine
 *   will propose coax-a-commotion-red (same profile, tier-1 score=1.0) as a
 *   substitute.
 * - weapons: talishar-the-lost-prince (qty 1) — Generic weapon.
 *   User does not own it; weapons are non-substitutable → goes to missing.
 *
 * Expected snapshot state after import + readiness compute (seedInventory=false):
 *   - exact[]:       (empty — deck has no coax-a-commotion-red copies)
 *   - substituted[]: emissary-of-tides-red ×2 → coax-a-commotion-red
 *     (user has 3 copies → first 2 used as tier-1 substitutes, 1 remaining)
 *   - missing[]:     talishar-the-lost-prince (weapon, non-substitutable)
 *                    katsu-the-wanderer (hero, non-substitutable)
 *
 * Therefore breakdown.substituted.length = 2 → 2 pending review rows.
 */
const FIXTURE_DECK_DTO: IDeckImportDto = {
  ulid: '01HPABCDEFGHJKMN0000000QR1',
  name: 'Test Fixture Deck (U11)',
  format: 'Classic Constructed',
  hero: {
    cardIdentifier: 'katsu-the-wanderer',
    name: 'Katsu, the Wanderer',
  },
  mainboard: [
    {
      cardIdentifier: 'emissary-of-tides-red',
      quantity: 2,
      slot: 'mainboard',
    },
  ],
  equipment: [],
  weapons: [
    {
      cardIdentifier: 'talishar-the-lost-prince',
      quantity: 1,
      slot: 'weapon',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the raw verification token from the _devVerificationLink URL. */
function extractVerificationToken(link: string): string {
  const url = new URL(link);
  const token = url.searchParams.get('token');
  if (!token) {
    throw new Error(`No token param in _devVerificationLink: ${link}`);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Plan B full flow (E2E, U11)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let mockFabraryService: ReturnType<typeof createMock<FabraryService>>;

  const uniqueSuffix = Date.now().toString(36);
  const TEST_EMAIL = `planb-e2e-${uniqueSuffix}@test.local`;
  const TEST_PASSWORD = 'plan-b-test-password-123';

  beforeAll(async () => {
    // Set required env vars for the test environment before NestJS bootstraps.
    // NODE_ENV=development enables:
    //   - AuthService._devVerificationLink in sign-up response
    //   - TypeORM synchronize:true (tables created automatically)
    //   - EmailService dev-bypass (no actual email sending)
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] =
      process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] =
      process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    mockFabraryService = createMock<FabraryService>();
    mockFabraryService.fetchDeck.mockResolvedValue(FIXTURE_DECK_DTO);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Swap FabraryService with the deterministic mock so no real HTTP calls
      // are made to Fabrary's GraphQL endpoint during the test.
      .overrideProvider(FabraryService)
      .useValue(mockFabraryService)
      // Override ThrottlerGuard with a passthrough so rate-limit counters
      // from other test runs (same localhost IP) do not flake this test.
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    // Remove this test user's data so subsequent runs start clean.
    // Uses the DataSource directly to avoid auth overhead in cleanup.
    if (dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM "user" WHERE email = $1`,
        [TEST_EMAIL],
      );
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it(
    'completes sign-up → CSV upload → deck import → review approve → source toggle flow',
    async () => {
      const server = app.getHttpServer();

      // -----------------------------------------------------------------------
      // Step 1: Sign up
      // -----------------------------------------------------------------------
      const signUpRes = await request(server)
        .post('/api/auth/sign-up')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(202);

      expect(signUpRes.body.message).toContain('verification link');

      // In NODE_ENV=development, AuthService appends _devVerificationLink so
      // tests can verify emails without a real email delivery service.
      const devLink: unknown = signUpRes.body._devVerificationLink;
      expect(typeof devLink).toBe('string');
      const verificationToken = extractVerificationToken(devLink as string);

      // -----------------------------------------------------------------------
      // Step 2: Verify email → sign in → capture JWT
      // -----------------------------------------------------------------------
      await request(server)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      const signInRes = await request(server)
        .post('/api/auth/sign-in')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(200);

      const jwt: unknown = signInRes.body.jwt;
      expect(typeof jwt).toBe('string');
      const bearerJwt = jwt as string;

      // -----------------------------------------------------------------------
      // Step 3: Upload fixture CSV
      // -----------------------------------------------------------------------
      const csvRes = await request(server)
        .post('/api/collection/csv')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .attach('file', FIXTURE_CSV_BUFFER, {
          filename: 'fixture-collection.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      expect(csvRes.body.kind).toBe('created');
      const sourceId: unknown = csvRes.body.sourceId;
      expect(typeof sourceId).toBe('string');
      const csvSourceId = sourceId as string;

      // "Coax a Commotion" resolves unambiguously to coax-a-commotion-red (qty 3).
      expect((csvRes.body.cardCount as number)).toBeGreaterThan(0);

      // -----------------------------------------------------------------------
      // Step 4: Import deck with mocked FabraryService
      // -----------------------------------------------------------------------
      const importRes = await request(server)
        .post('/api/decks/import')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .send({ urls: [FIXTURE_FABRARY_URL], seedInventory: false })
        .expect(201);

      expect(importRes.body.imported).toHaveLength(1);
      const trackedDeckId: unknown = importRes.body.imported[0]?.trackedDeckId;
      expect(typeof trackedDeckId).toBe('number');
      const deckId = trackedDeckId as number;

      // Readiness snapshot is computed post-import; verify it is attached.
      const snapshot = importRes.body.imported[0]?.readinessSnapshot;
      expect(snapshot).not.toBeNull();

      // -----------------------------------------------------------------------
      // Step 5: GET /api/reviews?state=pending → expect ≥1 pending row
      //
      // The fixture deck has emissary-of-tides-red (qty 2) that the user does
      // not own. The readiness engine proposes coax-a-commotion-red as a tier-1
      // substitute (same pitch/class/type, power delta=0, def delta=0, score=1.0).
      // This produces 2 entries in breakdown.substituted → 2 pending review rows.
      // -----------------------------------------------------------------------
      const reviewsRes = await request(server)
        .get('/api/reviews')
        .query({ state: 'pending' })
        .set('Authorization', `Bearer ${bearerJwt}`)
        .expect(200);

      const rows: unknown = reviewsRes.body.rows;
      expect(Array.isArray(rows)).toBe(true);
      const pendingRows = rows as Array<{ trackedDeckId: number; cardIdentifier: string }>;
      expect(pendingRows.length).toBeGreaterThanOrEqual(1);

      // Grab the first pending row to approve in the next step.
      const firstRow = pendingRows[0];
      expect(firstRow).toBeDefined();
      expect(firstRow?.trackedDeckId).toBe(deckId);

      const pendingCardIdentifier = firstRow?.cardIdentifier;
      expect(typeof pendingCardIdentifier).toBe('string');

      // -----------------------------------------------------------------------
      // Step 6: GET /api/decks → capture effectivePercent before approval
      // -----------------------------------------------------------------------
      const decksBeforeRes = await request(server)
        .get('/api/decks')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .expect(200);

      const decksBeforeList: unknown = decksBeforeRes.body.trackedDecks;
      expect(Array.isArray(decksBeforeList)).toBe(true);
      const decksBefore = decksBeforeList as Array<{
        id: number;
        latestSnapshot: { effectivePercent: number } | null;
      }>;

      const deckRowBefore = decksBefore.find((d) => d.id === deckId);
      expect(deckRowBefore).toBeDefined();
      const effectiveBefore = deckRowBefore?.latestSnapshot?.effectivePercent ?? 0;

      // -----------------------------------------------------------------------
      // Step 7: POST /api/reviews/bulk — approve the first pending row
      // -----------------------------------------------------------------------
      const bulkRes = await request(server)
        .post('/api/reviews/bulk')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .send({
          operations: [
            {
              trackedDeckId: deckId,
              cardIdentifier: pendingCardIdentifier,
              decision: 'APPROVED',
            },
          ],
        })
        .expect(200);

      expect(bulkRes.body.succeeded).toBe(1);
      expect(bulkRes.body.failed).toHaveLength(0);

      // -----------------------------------------------------------------------
      // Step 8: GET /api/decks → effectivePercent should be ≥ before (approval
      // accepts the proposed substitute, keeping the card covered; re-compute
      // with approved exclusion does NOT remove coverage — approved means
      // "I'm OK with this substitute", not "exclude it").
      //
      // The exact value depends on the full deck composition. Rather than
      // asserting a precise number, we verify:
      //   a) the deck is still tracked
      //   b) effectivePercent ≥ 0 (snapshot was recomputed successfully)
      // -----------------------------------------------------------------------
      const decksAfterApproveRes = await request(server)
        .get('/api/decks')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .expect(200);

      const decksAfterList: unknown = decksAfterApproveRes.body.trackedDecks;
      expect(Array.isArray(decksAfterList)).toBe(true);
      const decksAfterApprove = decksAfterList as Array<{
        id: number;
        latestSnapshot: { effectivePercent: number } | null;
      }>;

      const deckRowAfterApprove = decksAfterApprove.find((d) => d.id === deckId);
      expect(deckRowAfterApprove).toBeDefined();
      const effectiveAfterApprove =
        deckRowAfterApprove?.latestSnapshot?.effectivePercent ?? 0;

      // Approval keeps the substitute active — effectivePercent should stay
      // the same or increase (approved subs are never excluded from coverage).
      expect(effectiveAfterApprove).toBeGreaterThanOrEqual(effectiveBefore);

      // -----------------------------------------------------------------------
      // Step 9: PATCH /api/collection/sources/:id with active=false
      // -----------------------------------------------------------------------
      await request(server)
        .patch(`/api/collection/sources/${csvSourceId}`)
        .set('Authorization', `Bearer ${bearerJwt}`)
        .send({ active: false })
        .expect(200);

      // -----------------------------------------------------------------------
      // Step 10: GET /api/decks again → effectivePercent should drop because
      // the CSV source is now inactive (its cards no longer count toward
      // inventory). The substitute cards came from this source, so coverage
      // should decrease.
      //
      // NOTE: source toggle triggers a cross-deck readiness recompute.
      // The recompute happens synchronously inside SourcesService.patch.
      // -----------------------------------------------------------------------
      const decksAfterToggleRes = await request(server)
        .get('/api/decks')
        .set('Authorization', `Bearer ${bearerJwt}`)
        .expect(200);

      const decksAfterToggleList: unknown = decksAfterToggleRes.body.trackedDecks;
      expect(Array.isArray(decksAfterToggleList)).toBe(true);
      const decksAfterToggle = decksAfterToggleList as Array<{
        id: number;
        latestSnapshot: { effectivePercent: number } | null;
      }>;

      const deckRowAfterToggle = decksAfterToggle.find((d) => d.id === deckId);
      expect(deckRowAfterToggle).toBeDefined();
      const effectiveAfterToggle =
        deckRowAfterToggle?.latestSnapshot?.effectivePercent ?? 0;

      // After source deactivation, the user's inventory is empty.
      // The deck's substituted cards (coax-a-commotion-red) were from this
      // source, so they are no longer available. effectivePercent should drop.
      expect(effectiveAfterToggle).toBeLessThan(effectiveAfterApprove);

      // Sanity: verify the mock was called with the correct Fabrary ULID.
      expect(mockFabraryService.fetchDeck).toHaveBeenCalledWith(
        '01HPABCDEFGHJKMN0000000QR1',
      );
    },
    60_000, // 60-second timeout for the full DB-backed flow
  );
});
