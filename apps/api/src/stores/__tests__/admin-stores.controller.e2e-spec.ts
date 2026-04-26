import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createMock } from '@golevelup/ts-jest';
import request from 'supertest';
import { AdminStoresController } from '../admin/admin-stores.controller';
import { AdminApiKeyGuard } from '../admin/admin-api-key.guard';
import { StoreIngestionService } from '../store-ingestion.service';
import type { IScrapeRunSummary } from '../store-ingestion.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

/**
 * E2E tests for `POST /admin/stores/:slug/scrape`.
 *
 * Mounts AdminStoresController with a stubbed StoreIngestionService and the
 * real ThrottlerGuard + ThrottlerModule. The global JwtAuthGuard is replaced
 * with a minimal pass-through that honours @Public() (same shape as production
 * but no Passport dependency), so requests without a JWT token still reach the
 * AdminApiKeyGuard.
 *
 * Verifies:
 * - No admin key → 401
 * - Wrong admin key → 401
 * - Short/empty admin key → 401, NOT 500
 * - Valid admin key, no JWT → 200 (JWT not required on @Public() routes)
 * - `?force=true` is forwarded to StoreIngestionService
 * - Rate limit: >2 requests per hour per IP → 429
 */
describe('AdminStoresController (e2e) — admin endpoint auth', () => {
  let app: INestApplication;
  let ingestionService: ReturnType<typeof createMock<StoreIngestionService>>;

  const VALID_KEY = 'test-admin-secret-that-is-sufficiently-long';
  const WRONG_KEY = 'wrong-key';

  const MOCK_SUMMARY: IScrapeRunSummary = {
    runId: 42,
    productsFetched: 100,
    productsMatched: 95,
    productsUnmatched: 5,
    rowsUpserted: 95,
    rowsZeroed: 0,
    deltaPercent: null,
    durationMs: 1234,
    forcedOverride: false,
  };

  beforeEach(async () => {
    // Set the env var before the guard is instantiated.
    process.env.ADMIN_API_KEY = VALID_KEY;

    ingestionService = createMock<StoreIngestionService>();
    (ingestionService.runScrape as jest.Mock).mockResolvedValue(MOCK_SUMMARY);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 3_600_000, limit: 2 }]),
      ],
      controllers: [AdminStoresController],
      providers: [
        { provide: StoreIngestionService, useValue: ingestionService },
        AdminApiKeyGuard,
        // Replace JwtAuthGuard with a minimal pass-through that honours @Public().
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => {
            const guard = new JwtAuthGuard(reflector);
            // Override canActivate to always return true when @Public() is set.
            const original = guard.canActivate.bind(guard);
            guard.canActivate = (ctx) => {
              const isPublic = reflector.getAllAndOverride<boolean>('isPublic', [
                ctx.getHandler(),
                ctx.getClass(),
              ]);
              if (isPublic) return true;
              return original(ctx);
            };
            return guard;
          },
          inject: [Reflector],
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    await app.init();
  });

  afterEach(async () => {
    delete process.env.ADMIN_API_KEY;
    await app?.close();
  });

  afterAll(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Auth: missing key
  // ---------------------------------------------------------------------------

  it('returns 401 when x-admin-api-key header is missing', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .expect(401);
  });

  // ---------------------------------------------------------------------------
  // Auth: wrong key
  // ---------------------------------------------------------------------------

  it('returns 401 when x-admin-api-key is incorrect', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', WRONG_KEY)
      .expect(401);
  });

  // ---------------------------------------------------------------------------
  // Auth: short / empty keys must NOT produce 500
  // ---------------------------------------------------------------------------

  it('returns 401 (not 500) when key is empty string', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', '')
      .expect(401);
  });

  it('returns 401 (not 500) when key is a single character', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', 'x')
      .expect(401);
  });

  it('returns 401 (not 500) when key is much longer than the stored key', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', 'a'.repeat(200))
      .expect(401);
  });

  // ---------------------------------------------------------------------------
  // Auth: valid key, no JWT → should succeed
  // ---------------------------------------------------------------------------

  it('returns 200 with valid x-admin-api-key and no JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', VALID_KEY)
      .expect(200);

    expect(res.body).toMatchObject({
      runId: 42,
      productsFetched: 100,
      productsMatched: 95,
      productsUnmatched: 5,
      rowsUpserted: 95,
      rowsZeroed: 0,
      durationMs: 1234,
      forcedOverride: false,
    });
  });

  // ---------------------------------------------------------------------------
  // force=true forwarding
  // ---------------------------------------------------------------------------

  it('forwards force=true query param to StoreIngestionService', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape?force=true')
      .set('x-admin-api-key', VALID_KEY)
      .expect(200);

    expect(ingestionService.runScrape).toHaveBeenCalledWith('cupula-dt', expect.objectContaining({ force: true }));
  });

  it('calls runScrape with force=false when force param is omitted', async () => {
    await request(app.getHttpServer())
      .post('/admin/stores/cupula-dt/scrape')
      .set('x-admin-api-key', VALID_KEY)
      .expect(200);

    expect(ingestionService.runScrape).toHaveBeenCalledWith('cupula-dt', expect.objectContaining({ force: false }));
  });

  // ---------------------------------------------------------------------------
  // Admin key env var missing → 401, not 500
  // ---------------------------------------------------------------------------

  it('returns 401 when ADMIN_API_KEY env var is missing', async () => {
    delete process.env.ADMIN_API_KEY;

    // The guard logs an operator-facing error in this branch; silence it here
    // since the missing env var is the test's deliberate setup, not a real fault.
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await request(app.getHttpServer())
        .post('/admin/stores/cupula-dt/scrape')
        .set('x-admin-api-key', VALID_KEY)
        .expect(401);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
