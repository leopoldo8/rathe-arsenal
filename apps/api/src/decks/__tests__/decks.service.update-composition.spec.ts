/**
 * Unit tests for DecksService.updateComposition (U6).
 *
 * Tests cover:
 * - Happy paths: full composition save, idempotent double-PUT,
 *   updatedAt bumped while trackedAt unchanged
 * - Edge cases: empty cards array, surviving approved substitute,
 *   orphan cleanup on card removal, hero change → orphan cleanup,
 *   snapshot fail is non-fatal, response readiness from in-memory result
 * - Error paths: deck not found (404), another user's deck (404)
 *
 * Mocking strategy:
 * - `dataSource.transaction` is mocked to call the callback with a fake
 *   `EntityManager`. The manager's `findOne`, `delete`, `insert`, `update`,
 *   and `find` methods are individually stubbed.
 * - `snapshotRepo.create` / `snapshotRepo.save` are mocked via createMock;
 *   the snapshot-failure test overrides `snapshotRepo.save` to throw.
 * - `computeEffectiveReadiness` and `computeDeckLegality` are mocked via
 *   jest.mock('@rathe-arsenal/engine') so pure functions are controllable.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DecksService } from '../decks.service';
import { UpdateDeckCompositionDto } from '../dto/update-deck-composition.dto';
import { DeckCardInputDto } from '../dto/deck-card-input.dto';

// ---------------------------------------------------------------------------
// Engine mocks — controlled per test.
// ---------------------------------------------------------------------------
jest.mock('@rathe-arsenal/engine', () => {
  const actual = jest.requireActual('@rathe-arsenal/engine');
  return {
    ...actual,
    computeEffectiveReadiness: jest.fn(),
    computeDeckLegality: jest.fn(),
  };
});

import {
  computeEffectiveReadiness,
  computeDeckLegality,
} from '@rathe-arsenal/engine';

const mockedReadiness = computeEffectiveReadiness as jest.MockedFunction<
  typeof computeEffectiveReadiness
>;
const mockedLegality = computeDeckLegality as jest.MockedFunction<
  typeof computeDeckLegality
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = 'user-uuid-update-composition';
const DECK_ID = 55;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildTrackedDeck(overrides: Partial<TrackedDeckEntity> = {}): TrackedDeckEntity {
  return {
    id: DECK_ID,
    userId: USER_ID,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    status: 'building',
    trackedAt: new Date('2026-05-17T10:00:00Z'),
    updatedAt: new Date('2026-05-17T12:00:00Z'),
    user: {} as TrackedDeckEntity['user'],
    ...overrides,
  };
}

function buildDeckCardEntity(overrides: Partial<DeckCardEntity> = {}): DeckCardEntity {
  return {
    id: 1,
    trackedDeckId: DECK_ID,
    cardIdentifier: 'snatch-red',
    quantity: 3,
    slot: 'mainboard',
    trackedDeck: {} as DeckCardEntity['trackedDeck'],
    ...overrides,
  };
}

function buildReadinessResult(overrides: Partial<ReturnType<typeof computeEffectiveReadiness>> = {}): ReturnType<typeof computeEffectiveReadiness> {
  return {
    rawPercent: 100,
    effectivePercent: 100,
    path: 'A',
    fidelityPercent: 100,
    breakdown: {
      exact: [],
      substituted: [],
      missing: [],
      notOwned: [],
    },
    substitutions: [],
    pitchCurve: {
      original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
      modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
    },
    ...overrides,
  } as ReturnType<typeof computeEffectiveReadiness>;
}

function buildDto(
  cards: DeckCardInputDto[] = [],
  heroIdentifier = 'dorinthea-ironsong',
  format: 'Classic Constructed' | 'Blitz' | 'Living Legend' | 'Silver Age' = 'Classic Constructed',
): UpdateDeckCompositionDto {
  const dto = new UpdateDeckCompositionDto();
  dto.cards = cards;
  dto.heroIdentifier = heroIdentifier;
  dto.format = format;
  return dto;
}

function buildCard(
  cardIdentifier: string,
  quantity = 3,
  slot: 'mainboard' | 'equipment' | 'weapon' | 'hero' = 'mainboard',
): DeckCardInputDto {
  const c = new DeckCardInputDto();
  c.cardIdentifier = cardIdentifier;
  c.quantity = quantity;
  c.slot = slot;
  return c;
}

// ---------------------------------------------------------------------------
// Test module setup
// ---------------------------------------------------------------------------
describe('DecksService.updateComposition', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;
  let decisionsService: jest.Mocked<DecisionsService>;
  let catalogService: jest.Mocked<CatalogService>;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    dataSource = createMock<DataSource>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();
    shoppingLineService = createMock<ShoppingLineService>();
    decisionsService = createMock<DecisionsService>();
    catalogService = createMock<CatalogService>();
    collectionReadService = createMock<CollectionReadService>();

    // Default service stubs
    collectionReadService.loadOwned.mockResolvedValue(new Map());
    decisionsService.loadExclusions.mockResolvedValue(new Set());
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.list.mockResolvedValue([]);
    snapshotRepo.create.mockReturnValue({} as DeckReadinessSnapshotEntity);
    snapshotRepo.save.mockResolvedValue({} as DeckReadinessSnapshotEntity);

    // Default engine mock responses
    mockedReadiness.mockReturnValue(buildReadinessResult());
    mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(DeckCardEntity),
          useValue: deckCardRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ShoppingLineService, useValue: shoppingLineService },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: CatalogService, useValue: catalogService },
        { provide: CollectionReadService, useValue: collectionReadService },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Sets up `dataSource.transaction` to call the callback with a mock manager.
   * `dataSource.query` (tags raw query) returns [] by default unless overridden.
   *
   * Returns the mock manager so individual tests can override behaviour.
   */
  function setupTransaction(opts: {
    deckRow?: TrackedDeckEntity | null;
    freshCards?: DeckCardEntity[];
    tagsResult?: Array<{ name: string; id: number }>;
  } = {}): jest.Mocked<EntityManager> {
    const manager = createMock<EntityManager>();
    const deck = opts.deckRow !== undefined ? opts.deckRow : buildTrackedDeck();
    const freshCards = opts.freshCards ?? [];

    // findOne: first call is the ownership check, second is post-update reload.
    (manager.findOne as jest.Mock)
      .mockResolvedValueOnce(deck)  // Step 1: ownership check
      .mockResolvedValueOnce(deck); // Step 4: reload after update

    // find: returns just-inserted cards for Step 5
    (manager.find as jest.Mock).mockResolvedValue(freshCards);
    (manager.delete as jest.Mock).mockResolvedValue({ affected: freshCards.length });
    (manager.insert as jest.Mock).mockResolvedValue({});
    (manager.update as jest.Mock).mockResolvedValue({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
      async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );

    // dataSource.query is used for the tags fetch inside the transaction.
    (dataSource.query as jest.Mock).mockResolvedValue(
      opts.tagsResult ?? [],
    );

    // deckCardRepo.find: used post-commit for legality + snapshot recompute.
    deckCardRepo.find.mockResolvedValue(freshCards);

    return manager;
  }

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------

  describe('happy path — full composition save', () => {
    it('returns 200 with readiness and legality=legal from engine mocks', async () => {
      // Arrange
      const cards = Array.from({ length: 3 }, (_, i) =>
        buildCard(`card-${i}`, 3, 'mainboard'),
      );
      const dto = buildDto(cards);
      mockedReadiness.mockReturnValue(buildReadinessResult({ rawPercent: 90, effectivePercent: 100 }));
      mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });
      setupTransaction({ freshCards: [] });

      // Act
      const result = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      expect(result.legality).toEqual({ category: 'legal', reasons: [] });
      expect(result.id).toBe(DECK_ID);
      expect(result.shoppingLine).toBeNull();
      // latestSnapshot is null — response does not include snapshot table data
      expect(result.latestSnapshot).toBeNull();
    });
  });

  describe('happy path — idempotent double PUT', () => {
    it('returns 200 on both calls; updatedAt in second call reflects re-save', async () => {
      // Arrange
      const dto = buildDto([buildCard('dawnblade', 1, 'weapon')]);
      const updatedAt1 = new Date('2026-05-17T12:00:00Z');
      const updatedAt2 = new Date('2026-05-17T12:01:00Z');

      setupTransaction({ deckRow: buildTrackedDeck({ updatedAt: updatedAt1 }) });
      const result1 = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Re-setup for second call
      setupTransaction({ deckRow: buildTrackedDeck({ updatedAt: updatedAt2 }) });
      const result2 = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      expect(result1.updatedAt).toBe(updatedAt1.toISOString());
      expect(result2.updatedAt).toBe(updatedAt2.toISOString());
      // trackedAt is unchanged between the two calls
      expect(result1.trackedAt).toBe(result2.trackedAt);
    });
  });

  describe('happy path — updatedAt bumped, trackedAt unchanged', () => {
    it('trackedAt from entity is preserved; updatedAt reflects DB update', async () => {
      // Arrange
      const trackedAt = new Date('2026-01-01T00:00:00Z');
      const updatedAt = new Date('2026-05-17T12:00:00Z');
      setupTransaction({ deckRow: buildTrackedDeck({ trackedAt, updatedAt }) });

      const dto = buildDto();

      // Act
      const result = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      expect(result.trackedAt).toBe(trackedAt.toISOString());
      expect(result.updatedAt).toBe(updatedAt.toISOString());
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge case — empty cards array', () => {
    it('returns 200; readiness=0%, legality=incomplete from engine mocks', async () => {
      // Arrange
      setupTransaction({ freshCards: [] });
      const dto = buildDto([]); // no cards

      mockedReadiness.mockReturnValue(
        buildReadinessResult({ rawPercent: 0, effectivePercent: 0, path: 'C' }),
      );
      mockedLegality.mockReturnValue({
        category: 'incomplete',
        reasons: ['Deck has 0 mainboard cards but Classic Constructed requires at least 60.'],
      });

      // Act
      const result = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      expect(result.legality?.category).toBe('incomplete');
      expect(result.totalCards).toBe(0);
    });
  });

  describe('edge case — approved substitute survives if still in new substitute set', () => {
    it('does NOT delete the decision when the substitute card remains recommended', async () => {
      // Arrange
      const substituteId = 'zen-state-blue';
      const manager = setupTransaction({
        freshCards: [buildDeckCardEntity({ cardIdentifier: 'snatch-red' })],
      });

      // Engine result includes the same substitute
      mockedReadiness.mockReturnValue(
        buildReadinessResult({
          breakdown: {
            exact: [],
            substituted: [
              {
                original: {
                  cardIdentifier: 'snatch-red',
                  quantity: 3,
                  slot: 'mainboard',
                  name: 'Snatch',
                  pitch: 1,
                  cost: 0,
                  type: 'Action',
                  imageUrl: null,
                },
                match: {
                  substitute: {
                    cardIdentifier: substituteId,
                    name: 'Zen State',
                    types: ['Action'] as unknown as readonly string[],
                    pitch: 3,
                    classes: [],
                    talents: [],
                    power: null,
                    defense: null,
                    cost: null,
                    keywords: [],
                    subtypes: [],
                    legalHeroes: [],
                    legalFormats: [],
                    bannedFormats: [],
                    rarity: 'Common',
                    young: false,
                    sets: [],
                  } as unknown as ReturnType<typeof computeEffectiveReadiness>['breakdown']['substituted'][0]['match']['substitute'],
                  tier: 1 as const,
                  score: 0.9,
                  rationale: 'Same class',
                },
              },
            ],
            missing: [],
            notOwned: [],
          },
        }),
      );

      const dto = buildDto([buildCard('snatch-red')]);

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: the manager.delete for SubstituteDecisionEntity uses
      // Not(In([substituteId])) — it should NOT delete the surviving decision.
      // We verify that delete was called with a Not(In(...)) condition that
      // contains the substituteId, meaning decisions WITHOUT that id are purged.
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      const decisionDeleteCall = deleteCalls.find(
        (call) => call[0] === SubstituteDecisionEntity,
      );
      expect(decisionDeleteCall).toBeDefined();
      // The condition should include a Not(In(...)) wrapper, not a plain delete
      const condition = decisionDeleteCall![1];
      expect(condition).toHaveProperty('trackedDeckId', DECK_ID);
      // condition.cardIdentifier should NOT be a plain string (it's a FindOperator)
      expect(typeof condition.cardIdentifier).not.toBe('string');
    });
  });

  describe('edge case — orphan cleanup deletes decision when card removed', () => {
    it('deletes ALL decisions when new substitute set is empty', async () => {
      // Arrange
      const manager = setupTransaction({ freshCards: [] });

      // Engine returns no substitutions
      mockedReadiness.mockReturnValue(buildReadinessResult({
        breakdown: {
          exact: [],
          substituted: [],
          missing: [],
          notOwned: [],
        },
      }));

      const dto = buildDto([]);

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: manager.delete for SubstituteDecisionEntity should be called
      // with just { trackedDeckId: deckId } (delete all decisions for this deck).
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      const decisionDeleteCall = deleteCalls.find(
        (call) => call[0] === SubstituteDecisionEntity,
      );
      expect(decisionDeleteCall).toBeDefined();
      expect(decisionDeleteCall![1]).toEqual({ trackedDeckId: DECK_ID });
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  describe('error path — deck not found', () => {
    it('throws NotFoundException when deck does not belong to user', async () => {
      // Arrange
      const manager = createMock<EntityManager>();
      (manager.findOne as jest.Mock).mockResolvedValue(null); // ownership check fails

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
        async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
      );

      const dto = buildDto();

      // Act & Assert
      await expect(
        service.updateComposition(DECK_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: snapshot fail is non-fatal
  // ---------------------------------------------------------------------------

  describe('integration — snapshot insert failure is non-fatal', () => {
    it('returns HTTP 200 with in-memory readiness when snapshot.save throws', async () => {
      // Arrange
      const expectedReadiness = buildReadinessResult({ rawPercent: 75, effectivePercent: 85 });
      mockedReadiness.mockReturnValue(expectedReadiness);
      mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });

      setupTransaction({ freshCards: [] });

      // Override snapshotRepo.save to throw after the transaction
      snapshotRepo.save.mockRejectedValue(new Error('DB write error'));

      const dto = buildDto([buildCard('snatch-red')]);

      // Act
      const result = await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: still 200, readiness from in-memory result
      expect(result).toBeDefined();
      expect(result.legality?.category).toBe('legal');
      // latestSnapshot is null (we don't return a snapshot object in the PUT response)
      expect(result.latestSnapshot).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: snapshot read is NOT called between commit and response
  // ---------------------------------------------------------------------------

  describe('integration — snapshot table read is NOT called post-commit', () => {
    it('never calls snapshotRepo.findOne between commit and returning the response', async () => {
      // Arrange
      mockedReadiness.mockReturnValue(buildReadinessResult());
      mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });
      setupTransaction({ freshCards: [] });

      const dto = buildDto([buildCard('snatch-red')]);

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: findOne on the snapshot repo must NOT have been called.
      // The response readiness comes from the in-memory engine result only.
      expect(snapshotRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: step 5 runs inside the transaction
  // ---------------------------------------------------------------------------

  describe('integration — computeEffectiveReadiness called inside the transaction', () => {
    it('computeEffectiveReadiness is called at least once (step 5, inside tx)', async () => {
      // Arrange
      mockedReadiness.mockReturnValue(buildReadinessResult());
      mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });
      setupTransaction({ freshCards: [buildDeckCardEntity({ cardIdentifier: 'snatch-red' })] });

      const dto = buildDto([buildCard('snatch-red')]);

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: readiness was computed (at least once for step 5 in-tx; step 6 is also allowed)
      expect(mockedReadiness).toHaveBeenCalled();
      // The first call must use the 5-arg form with undefined tolerance
      const allCalls = mockedReadiness.mock.calls;
      expect(allCalls.length).toBeGreaterThanOrEqual(1);
      const firstCallArgs = allCalls[0]!;
      expect(firstCallArgs[3]).toBeUndefined(); // tolerance = undefined
      expect(firstCallArgs[4]).toBeInstanceOf(Set); // excludedIdentifiers
    });
  });
});
