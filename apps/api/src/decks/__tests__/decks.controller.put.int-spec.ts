/**
 * Integration tests for PUT /decks/:deckId (U6).
 *
 * Tests route wiring, DTO validation, guard behaviour, and response shape
 * using a slim NestJS app with no database. The real JwtAuthGuard is absent
 * because it lives at APP_GUARD scope; we inject the user shape via middleware.
 * OwnsTrackedDeckGuard is overridden to keep tests focused on the PUT contract.
 *
 * Guard 404 behaviour is tested using a dedicated guard instance that throws
 * NotFoundException.
 */
import {
  HttpStatus,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { DecksController } from '../decks.controller';
import { DecksService } from '../decks.service';
import { OwnsTrackedDeckGuard } from '../../auth/guards/owns-tracked-deck.guard';
import { HeroIdentifierExistsInCatalog } from '../validators/hero-identifier-exists.validator';
import { ITrackedDeckDetailResponse } from '../dtos/tracked-deck-detail.response.dto';
import { configureHttpApp } from '../../http/configure-http-app';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';

const USER_ID = 'user-uuid-put-int';
const DECK_ID = 77;

function buildDetailResponse(
  overrides: Partial<ITrackedDeckDetailResponse> = {},
): ITrackedDeckDetailResponse {
  return {
    id: DECK_ID,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    status: 'building',
    tags: [],
    notes: null,
    trackedAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-17T12:00:00.000Z',
    totalCards: 60,
    cards: [],
    latestSnapshot: null,
    shoppingLine: null,
    legality: { category: 'legal', reasons: [], details: [] },
    replacements: [],
    ...overrides,
  };
}

async function buildApp(opts: {
  userId: string;
  decksService: jest.Mocked<DecksService>;
  guardOverride?: { canActivate: () => boolean | Promise<boolean> };
}): Promise<INestApplication> {
  const { userId, decksService, guardOverride } = opts;

  const builder = Test.createTestingModule({
    controllers: [DecksController],
    providers: [
      { provide: DecksService, useValue: decksService },
      // Validator registered as a provider — falls back to static catalog
      // singleton (as documented in validator and module).
      HeroIdentifierExistsInCatalog,
    ],
  }).overrideGuard(OwnsTrackedDeckGuard);

  const moduleRef: TestingModule = await (
    guardOverride
      ? builder.useValue(guardOverride)
      : builder.useValue({ canActivate: () => true })
  ).compile();

  const app = moduleRef.createNestApplication();

  // Inject the current user via middleware (mirrors the global JwtAuthGuard).
  app.use((req: Request & { user?: object }, _res: Response, next: NextFunction) => {
    req.user = { userId, email: 'test@example.com' };
    next();
  });

  configureHttpApp(app);

  await app.listen(0, '127.0.0.1');
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validBody(overrides: Partial<{
  cards: object[];
  heroIdentifier: string;
  format: string;
}> = {}): object {
  return {
    cards: [
      { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
    ],
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('DecksController PUT /decks/:deckId (int-spec)', () => {
  let app: INestApplication;
  let decksService: jest.Mocked<DecksService>;

  beforeEach(async () => {
    decksService = createMock<DecksService>();
    app = await buildApp({ userId: USER_ID, decksService });
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------

  describe('happy path — valid body returns 200 with legality=legal', () => {
    it('routes to service.updateComposition and returns the detail payload', async () => {
      // Arrange
      const response = buildDetailResponse({ legality: { category: 'legal', reasons: [], details: [] } });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.legality.category).toBe('legal');
      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({
          heroIdentifier: 'dorinthea-ironsong',
          format: 'Classic Constructed',
        }),
      );
    });
  });

  describe('a deck with problems', () => {
    it('a deck with problems is saved as is', async () => {
      const response = buildDetailResponse({
        format: 'Blitz',
        legality: { category: 'illegal', reasons: [], details: [] },
      });
      decksService.updateComposition.mockResolvedValue(response);

      const res = await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(
          validBody({
            heroIdentifier: 'rhinar',
            format: 'Blitz',
            cards: [{ cardIdentifier: 'pack-hunt-red', quantity: 2, slot: 'mainboard' }],
          }),
        )
        .expect(HttpStatus.OK);

      expect(res.body.legality.category).toBe('illegal');
      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({ cards: [{ cardIdentifier: 'pack-hunt-red', quantity: 2, slot: 'mainboard' }] }),
      );
    });
  });

  describe('happy path — empty cards array is accepted', () => {
    it('returns 200 with legality=incomplete for zero cards', async () => {
      // Arrange
      const response = buildDetailResponse({
        totalCards: 0,
        legality: { category: 'incomplete', reasons: ['Deck has 0 mainboard cards.'], details: [] },
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ cards: [] }))
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.legality.category).toBe('incomplete');
      expect(res.body.totalCards).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths — DTO validation
  // ---------------------------------------------------------------------------

  describe('error path — 151 cards triggers 400', () => {
    it('returns 400 when cards array exceeds 150 entries', async () => {
      // Arrange
      const cards = Array.from({ length: 151 }, (_, i) => ({
        cardIdentifier: `card-${i}`,
        quantity: 1,
        slot: 'mainboard',
      }));

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — quantity=5 triggers 400', () => {
    it('returns 400 when a card has quantity > 4', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 5, slot: 'mainboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — quantity=0 triggers 400', () => {
    it('returns 400 when a card has quantity < 1', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 0, slot: 'mainboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('error path — invalid slot triggers 400', () => {
    it('returns 400 when slot is not in the allowed set', async () => {
      // Arrange
      const cards = [{ cardIdentifier: 'snatch-red', quantity: 3, slot: 'sideboard' }];

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ cards }))
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('error path — heroIdentifier not in catalog triggers 400', () => {
    it('returns 400 when heroIdentifier is not a known hero', async () => {
      // The HeroIdentifierExistsInCatalog validator uses the real static catalog.
      // 'not-a-real-hero' is not in the catalog so it will fail validation.
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ heroIdentifier: 'not-a-real-hero' }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('error path — format=Clash triggers 400', () => {
    it('returns 400 when format is not in the supported list', async () => {
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ format: 'Clash' }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(decksService.updateComposition).not.toHaveBeenCalled();
    });
  });

  describe('omitted heroIdentifier — resolved by the service from deck.hero (#84)', () => {
    it('accepts the body and forwards it to updateComposition without a hero', async () => {
      decksService.updateComposition.mockResolvedValue(buildDetailResponse());
      const { heroIdentifier: _omitted, ...bodyWithoutHero } = validBody() as {
        heroIdentifier: string;
        cards: object[];
        format: string;
      };

      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(bodyWithoutHero)
        .expect(HttpStatus.OK);

      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.not.objectContaining({ heroIdentifier: expect.anything() }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Error path — guard throws 404 for another user's deck
  // ---------------------------------------------------------------------------

  describe('error path — another user deck → 404', () => {
    it('returns 404 when OwnsTrackedDeckGuard throws NotFoundException', async () => {
      // Arrange — rebuild app with a guard that throws NotFoundException
      await app.close();
      app = await buildApp({
        userId: USER_ID,
        decksService: createMock<DecksService>(),
        guardOverride: {
          canActivate: () => {
            throw new NotFoundException('Tracked deck not found');
          },
        },
      });

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  describe('response shape — legality field is present', () => {
    it('response includes legality.category and legality.reasons', async () => {
      // Arrange
      const response = buildDetailResponse({
        legality: { category: 'legal', reasons: [], details: [] },
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body).toHaveProperty('legality');
      expect(res.body.legality).toHaveProperty('category', 'legal');
      expect(res.body.legality).toHaveProperty('reasons');
      expect(Array.isArray(res.body.legality.reasons)).toBe(true);
    });
  });

  describe('response shape — updatedAt is present', () => {
    it('response includes updatedAt and trackedAt', async () => {
      // Arrange
      const response = buildDetailResponse({
        trackedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-05-17T12:00:00.000Z',
      });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      const res = await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody())
        .expect(HttpStatus.OK);

      // Assert
      expect(res.body.trackedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(res.body.updatedAt).toBe('2026-05-17T12:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------------
  // All four valid formats are accepted
  // ---------------------------------------------------------------------------

  describe.each([
    'Classic Constructed',
    'Blitz',
    'Living Legend',
    'Silver Age',
  ])('happy path — format=%s is accepted', (format) => {
    it(`routes to service.updateComposition with format="${format}"`, async () => {
      // Arrange
      const response = buildDetailResponse({ format });
      decksService.updateComposition.mockResolvedValue(response);

      // Act
      await request(app.getHttpServer())
        .put(`/api/decks/${DECK_ID}`)
        .send(validBody({ format }))
        .expect(HttpStatus.OK);

      // Assert
      expect(decksService.updateComposition).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.objectContaining({ format }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Against a real database: the inventory quantity of a composition row (door 3) and the stage
// that no verdict writes. The slim app above mocks the service, so what is stored is checked here.
// ---------------------------------------------------------------------------
describe('DecksController PUT /decks/:deckId against Postgres (int-spec)', () => {
  let fixture: IFixture;
  let sessionToken: string;

  beforeAll(async () => {
    fixture = await bootFixture();
    ({ sessionToken } = await fixture.signUp('put-inventory'));
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function createDeck(format = 'Classic Constructed', heroIdentifier = 'dorinthea-ironsong'): Promise<number> {
    const created = await fixture.post('/api/decks', sessionToken).send({ heroIdentifier, format }).expect(201);
    return created.body.id as number;
  }

  function put(deckId: number, cards: readonly object[], token = sessionToken) {
    return fixture
      .put(`/api/decks/${deckId}`, token)
      .send({ heroIdentifier: 'dorinthea-ironsong', format: 'Classic Constructed', cards });
  }

  async function storedRows(deckId: number): Promise<Array<{ cardIdentifier: string; slot: string; quantity: number; inventoryQuantity: number }>> {
    return fixture.dataSource.query(
      `SELECT "cardIdentifier", slot, quantity, "inventoryQuantity" FROM deck_card WHERE "trackedDeckId" = $1 ORDER BY "cardIdentifier", slot`,
      [deckId],
    );
  }

  const SAVED = [
    { cardIdentifier: 'pack-hunt-red', quantity: 3, inventoryQuantity: 1, slot: 'mainboard' },
    { cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 2, slot: 'mainboard' },
    { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
  ];

  it('composition rows carry inventoryQuantity', async () => {
    const deckId = await createDeck();

    const saved = await put(deckId, SAVED).expect(200);

    const expectedRows = [
      { cardIdentifier: 'dawnblade', slot: 'weapon', quantity: 1, inventoryQuantity: 0 },
      { cardIdentifier: 'pack-hunt-red', slot: 'mainboard', quantity: 3, inventoryQuantity: 1 },
      { cardIdentifier: 'snatch-red', slot: 'mainboard', quantity: 0, inventoryQuantity: 2 },
    ];
    expect(await storedRows(deckId)).toEqual(expectedRows);
    const byCard = (rows: Array<{ cardIdentifier: string }>) =>
      [...rows].sort((a, b) => a.cardIdentifier.localeCompare(b.cardIdentifier));
    expect(byCard(saved.body.cards)).toEqual(expectedRows);
    const read = await fixture.get(`/api/decks/${deckId}`, sessionToken).expect(200);
    expect(byCard(read.body.cards)).toEqual(expectedRows);
  });

  it('invalid inventory quantities are rejected', async () => {
    const deckId = await createDeck();
    await put(deckId, SAVED).expect(200);
    const before = await storedRows(deckId);

    const bodies: ReadonlyArray<[string, object]> = [
      ['inventoryQuantity -1', { cardIdentifier: 'snatch-red', quantity: 1, inventoryQuantity: -1, slot: 'mainboard' }],
      ['inventoryQuantity 1.5', { cardIdentifier: 'snatch-red', quantity: 1, inventoryQuantity: 1.5, slot: 'mainboard' }],
      ['both quantities 0', { cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 0, slot: 'mainboard' }],
      ['quantity 0 and no inventory field', { cardIdentifier: 'snatch-red', quantity: 0, slot: 'mainboard' }],
    ];
    for (const [label, row] of bodies) {
      await put(deckId, [SAVED[0]!, row]).expect(400);
      expect({ label, rows: await storedRows(deckId) }).toEqual({ label, rows: before });
    }
  });

  it('a repeated card and slot is rejected', async () => {
    const deckId = await createDeck();
    await put(deckId, SAVED).expect(200);
    const before = await storedRows(deckId);

    await put(deckId, [
      { cardIdentifier: 'snatch-red', quantity: 1, slot: 'mainboard' },
      { cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 1, slot: 'mainboard' },
    ]).expect(400);

    expect(await storedRows(deckId)).toEqual(before);
  });

  it('put answers 404 for a deck the player cannot edit', async () => {
    const deckId = await createDeck();
    await put(deckId, SAVED).expect(200);
    const before = await storedRows(deckId);
    const { sessionToken: stranger } = await fixture.signUp('put-stranger');

    await put(deckId, [{ cardIdentifier: 'snatch-red', quantity: 2, slot: 'mainboard' }], stranger).expect(404);

    expect(await storedRows(deckId)).toEqual(before);

    // A deleted deck cannot be edited either, by its own player: the deleted-deck half of C55.
    await fixture.dataSource.query(`UPDATE tracked_deck SET "deletedAt" = now() WHERE id = $1`, [deckId]);

    await put(deckId, [{ cardIdentifier: 'snatch-red', quantity: 2, slot: 'mainboard' }]).expect(404);

    expect(await storedRows(deckId)).toEqual(before);
  });

  it('the verdict never writes the stage', async () => {
    const deckId = await createDeck('Blitz', 'rhinar');
    await fixture.dataSource.query(`UPDATE tracked_deck SET status = 'active' WHERE id = $1`, [deckId]);
    const illegal = [{ cardIdentifier: 'pack-hunt-red', quantity: 2, slot: 'mainboard' }];

    const saved = await fixture
      .put(`/api/decks/${deckId}`, sessionToken)
      .send({ heroIdentifier: 'rhinar', format: 'Blitz', cards: illegal })
      .expect(200);
    const read = await fixture.get(`/api/decks/${deckId}`, sessionToken).expect(200);

    expect(saved.body.legality.category).toBe('illegal');
    expect(saved.body.status).toBe('active');
    expect(read.body.legality.category).toBe('illegal');
    expect(read.body.status).toBe('active');
  });
});
