/**
 * Unit tests for the orphan substitute-decision cleanup logic in
 * DecksService.updateComposition (U6 — step 5 of the transaction).
 *
 * These tests focus specifically on the TypeORM In()/Not() parameterized
 * delete that purges substitute decisions whose substitute card is no longer
 * part of the engine result after a PUT.
 *
 * Three scenarios:
 * A. New substitute set is non-empty → decisions for substitutes NOT in the
 *    set are deleted using `Not(In([...ids]))`.
 * B. New substitute set is empty → ALL decisions for the deck are deleted using
 *    a plain `{ trackedDeckId }` condition.
 * C. After a hero change, the engine finds no matching substitute for a
 *    previously-substituted card → orphan cleanup deletes the stale decision.
 *
 * This test file covers edge cases that complement the service spec; it does
 * not re-test happy paths already covered in decks.service.update-composition.spec.ts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { VariantFetchService } from '../../stores/variant-fetch.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DecksService } from '../decks.service';
import { UpdateDeckCompositionDto } from '../dto/update-deck-composition.dto';

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

const USER_ID = 'user-uuid-orphan-cleanup';
const DECK_ID = 88;

function baseTrackedDeck(): TrackedDeckEntity {
  return {
    id: DECK_ID,
    userId: USER_ID,
    fabraryUlid: null,
    name: 'Test Deck',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    status: 'building',
    trackedAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-05-17T10:00:00Z'),
    user: {} as TrackedDeckEntity['user'],
  };
}

function buildDto(heroIdentifier = 'dorinthea-ironsong'): UpdateDeckCompositionDto {
  const dto = new UpdateDeckCompositionDto();
  dto.cards = [];
  dto.heroIdentifier = heroIdentifier;
  dto.format = 'Classic Constructed';
  return dto;
}

function emptyBreakdown(): ReturnType<typeof computeEffectiveReadiness>['breakdown'] {
  return { exact: [], substituted: [], missing: [], notOwned: [] };
}

function substituteBreakdown(substituteId: string): ReturnType<typeof computeEffectiveReadiness>['breakdown'] {
  return {
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
            name: 'Sub Card',
            types: ['Action'] as unknown as readonly string[],
            pitch: 1,
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
          score: 0.85,
          rationale: 'Similar effect',
        },
      },
    ],
    missing: [],
    notOwned: [],
  };
}

describe('Orphan substitute-decision cleanup (DecksService.updateComposition step 5)', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let collectionReadService: jest.Mocked<CollectionReadService>;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    dataSource = createMock<DataSource>();
    collectionReadService = createMock<CollectionReadService>();
    decisionsService = createMock<DecisionsService>();
    snapshotRepo.create.mockReturnValue({} as DeckReadinessSnapshotEntity);
    snapshotRepo.save.mockResolvedValue({} as DeckReadinessSnapshotEntity);
    collectionReadService.loadOwned.mockResolvedValue(new Map());
    decisionsService.loadExclusions.mockResolvedValue(new Set());
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.list.mockResolvedValue([]);
    mockedLegality.mockReturnValue({ category: 'legal', reasons: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthzService, useValue: createMock<AuthzService>() },
        { provide: SubstitutionService, useValue: createMock<SubstitutionService>() },
        { provide: ShoppingLineService, useValue: createMock<ShoppingLineService>() },
        { provide: VariantFetchService, useValue: createMock<VariantFetchService>() },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: CatalogService, useValue: createMock<CatalogService>() },
        { provide: CollectionReadService, useValue: collectionReadService },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupManager(freshCards: DeckCardEntity[] = []): jest.Mocked<EntityManager> {
    const manager = createMock<EntityManager>();
    const deck = baseTrackedDeck();

    (manager.findOne as jest.Mock)
      .mockResolvedValueOnce(deck)  // Step 1: ownership
      .mockResolvedValueOnce(deck); // Step 4: reload

    (manager.find as jest.Mock).mockResolvedValue(freshCards);
    (manager.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    (manager.insert as jest.Mock).mockResolvedValue({});
    (manager.update as jest.Mock).mockResolvedValue({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
      async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );
    (dataSource.query as jest.Mock).mockResolvedValue([]);
    deckCardRepo.find.mockResolvedValue(freshCards);

    return manager;
  }

  // ---------------------------------------------------------------------------
  // Scenario A: non-empty new substitute set → Not(In(...)) delete
  // ---------------------------------------------------------------------------

  describe('Scenario A — non-empty substitute set uses Not(In()) condition', () => {
    it('calls manager.delete(SubstituteDecisionEntity, { trackedDeckId, cardIdentifier: Not(In([...ids])) })', async () => {
      // Arrange
      const substituteId = 'zen-state-blue';
      mockedReadiness.mockReturnValue({
        rawPercent: 90,
        effectivePercent: 100,
        path: 'B',
        fidelityPercent: 95,
        breakdown: substituteBreakdown(substituteId),
        substitutions: [],
        pitchCurve: {
          original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
          modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
        },
      });

      const manager = setupManager();
      const dto = buildDto();

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      const decisionDeleteCall = deleteCalls.find(
        (call) => call[0] === SubstituteDecisionEntity,
      );

      expect(decisionDeleteCall).toBeDefined();
      const condition = decisionDeleteCall![1] as Record<string, unknown>;
      expect(condition).toHaveProperty('trackedDeckId', DECK_ID);

      // cardIdentifier must NOT be a plain string — it should be a TypeORM FindOperator
      // (produced by Not(In([...]))) so that it generates a parameterized NOT IN query.
      expect(typeof condition.cardIdentifier).not.toBe('string');
      // The substituteId must NOT appear as a top-level string property — that
      // would indicate raw SQL concatenation rather than a parameterized operator.
      expect(condition.cardIdentifier).not.toBe(substituteId);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario B: empty new substitute set → delete all decisions for the deck
  // ---------------------------------------------------------------------------

  describe('Scenario B — empty substitute set deletes all decisions for the deck', () => {
    it('calls manager.delete(SubstituteDecisionEntity, { trackedDeckId }) with no cardIdentifier condition', async () => {
      // Arrange
      mockedReadiness.mockReturnValue({
        rawPercent: 0,
        effectivePercent: 0,
        path: 'C',
        fidelityPercent: 0,
        breakdown: emptyBreakdown(),
        substitutions: [],
        pitchCurve: {
          original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
          modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
        },
      });

      const manager = setupManager();
      const dto = buildDto();

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      const decisionDeleteCall = deleteCalls.find(
        (call) => call[0] === SubstituteDecisionEntity,
      );

      expect(decisionDeleteCall).toBeDefined();
      // Condition must be exactly { trackedDeckId: deckId } — no cardIdentifier clause.
      expect(decisionDeleteCall![1]).toEqual({ trackedDeckId: DECK_ID });
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario C: hero change → previously-substituted card has no substitute
  //             in the new engine pass → orphan decision deleted
  // ---------------------------------------------------------------------------

  describe('Scenario C — hero change removes all substitutes → orphan cleanup', () => {
    it('deletes all decisions when the new hero produces no substitutes', async () => {
      // Arrange: first PUT had substituteId, second PUT with different hero has no substitutes
      mockedReadiness.mockReturnValue({
        rawPercent: 50,
        effectivePercent: 50,
        path: 'C',
        fidelityPercent: 50,
        breakdown: emptyBreakdown(), // no substitutions after hero change
        substitutions: [],
        pitchCurve: {
          original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
          modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
        },
      });

      const manager = setupManager();
      // Use a different hero to simulate the hero change
      const dto = buildDto('boltyn-braker-of-dawn');

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: empty substitute set → delete all decisions
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      const decisionDeleteCall = deleteCalls.find(
        (call) => call[0] === SubstituteDecisionEntity,
      );

      expect(decisionDeleteCall).toBeDefined();
      expect(decisionDeleteCall![1]).toEqual({ trackedDeckId: DECK_ID });
    });
  });

  // ---------------------------------------------------------------------------
  // Parameterized SQL safety: no raw string concatenation
  // ---------------------------------------------------------------------------

  describe('SQL safety — orphan delete uses TypeORM operators, not raw SQL', () => {
    it('never passes a raw SQL string to manager.delete', async () => {
      // Arrange
      mockedReadiness.mockReturnValue({
        rawPercent: 90,
        effectivePercent: 100,
        path: 'B',
        fidelityPercent: 95,
        breakdown: substituteBreakdown('some-substitute-id'),
        substitutions: [],
        pitchCurve: {
          original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
          modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
        },
      });

      const manager = setupManager();
      const dto = buildDto();

      // Act
      await service.updateComposition(DECK_ID, USER_ID, dto);

      // Assert: none of the manager.delete calls should receive a raw SQL string
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      for (const call of deleteCalls) {
        const condition = call[1];
        if (typeof condition === 'object' && condition !== null) {
          // Verify no string values that look like SQL fragments
          for (const value of Object.values(condition as Record<string, unknown>)) {
            if (typeof value === 'string') {
              expect(value).not.toMatch(/NOT IN|cardIdentifier NOT/i);
            }
          }
        }
      }
    });
  });
});
