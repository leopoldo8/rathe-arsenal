/**
 * Unit tests for the orphan swap_suggestion cleanup logic in
 * DecksService.updateComposition (step 5 of the transaction).
 *
 * SWAP-02 replaces the old hard-delete orphan cleanup (which purged
 * `substitute_decision` rows via `Not(In([...]))`/`{ trackedDeckId }`)
 * with reconciliation: `SwapsReconciliationService.reconcile` is called
 * inside the same transaction with the fresh breakdown and the
 * transaction manager, and `reconcileSwapSuggestions` (unit-tested on its
 * own, without a DB, in `apps/api/src/swaps/__tests__/`) decides whether
 * each persisted row is retired, updated, or left alone. This file only
 * asserts the call-site wiring: the right breakdown, the right deck id,
 * and the transaction manager, land in the reconciliation call.
 *
 * Three scenarios:
 * A. New substitute set is non-empty → reconcile is called with a fresh
 *    breakdown containing that substitute.
 * B. New substitute set is empty → reconcile is called with an empty
 *    fresh breakdown (any previously-persisted row with no match and a
 *    now-absent position gets retired by the pure function).
 * C. After a hero change, the engine finds no matching substitute for a
 *    previously-substituted card → same empty-breakdown reconcile call.
 *
 * This test file covers edge cases that complement the service spec; it
 * does not re-test happy paths already covered in
 * decks.service.update-composition.spec.ts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';
import { SwapsReconciliationService } from '../../swaps/swaps-reconciliation.service';
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
    notes: null,
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
        approved: false,
      },
    ],
    missing: [],
    notOwned: [],
  };
}

describe('Orphan swap_suggestion cleanup (DecksService.updateComposition step 5)', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let collectionReadService: jest.Mocked<CollectionReadService>;
  let decisionsService: jest.Mocked<DecisionsService>;
  let swapSuggestionQueryService: jest.Mocked<SwapSuggestionQueryService>;
  let swapsReconciliationService: jest.Mocked<SwapsReconciliationService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    dataSource = createMock<DataSource>();
    collectionReadService = createMock<CollectionReadService>();
    decisionsService = createMock<DecisionsService>();
    swapSuggestionQueryService = createMock<SwapSuggestionQueryService>();
    swapsReconciliationService = createMock<SwapsReconciliationService>();
    snapshotRepo.create.mockReturnValue({} as DeckReadinessSnapshotEntity);
    snapshotRepo.save.mockResolvedValue({} as DeckReadinessSnapshotEntity);
    collectionReadService.loadOwned.mockResolvedValue(new Map());
    swapSuggestionQueryService.loadReadinessInputs.mockResolvedValue({
      excludedIdentifiers: new Set(),
      approvedIdentifiers: new Set(),
    });
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
        { provide: DecisionsService, useValue: decisionsService },
        { provide: CatalogService, useValue: createMock<CatalogService>() },
        { provide: CollectionReadService, useValue: collectionReadService },
        { provide: SwapSuggestionQueryService, useValue: swapSuggestionQueryService },
        { provide: SwapsReconciliationService, useValue: swapsReconciliationService },
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
  // Scenario A: non-empty new substitute set → reconcile with that breakdown
  // ---------------------------------------------------------------------------

  describe('Scenario A — non-empty substitute set reconciles with the fresh breakdown', () => {
    it('calls swapsReconciliationService.reconcile with the surviving substitute and the tx manager', async () => {
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

      await service.updateComposition(DECK_ID, USER_ID, dto);

      expect(swapsReconciliationService.reconcile).toHaveBeenCalledWith(
        USER_ID,
        DECK_ID,
        expect.objectContaining({
          substituted: expect.arrayContaining([
            expect.objectContaining({
              match: expect.objectContaining({
                substitute: expect.objectContaining({ cardIdentifier: substituteId }),
              }),
            }),
          ]),
        }),
        expect.any(Set),
        manager,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario B: empty new substitute set → reconcile with an empty breakdown
  // ---------------------------------------------------------------------------

  describe('Scenario B — empty substitute set reconciles with an empty breakdown', () => {
    it('calls swapsReconciliationService.reconcile with substituted: []', async () => {
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

      await service.updateComposition(DECK_ID, USER_ID, dto);

      expect(swapsReconciliationService.reconcile).toHaveBeenCalledWith(
        USER_ID,
        DECK_ID,
        expect.objectContaining({ substituted: [] }),
        expect.any(Set),
        manager,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario C: hero change → previously-substituted card has no substitute
  //             in the new engine pass → same empty-breakdown reconciliation
  // ---------------------------------------------------------------------------

  describe('Scenario C — hero change removes all substitutes → reconciles with an empty breakdown', () => {
    it('reconciles with substituted: [] when the new hero produces no substitutes', async () => {
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

      await service.updateComposition(DECK_ID, USER_ID, dto);

      expect(swapsReconciliationService.reconcile).toHaveBeenCalledWith(
        USER_ID,
        DECK_ID,
        expect.objectContaining({ substituted: [] }),
        expect.any(Set),
        manager,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // No hard delete: SWAP-02 forbids ever deleting a swap_suggestion row.
  // ---------------------------------------------------------------------------

  describe('SWAP-02 — orphan cleanup never hard-deletes', () => {
    it('never calls manager.delete for swap_suggestion rows; reconciliation is the only write path', async () => {
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

      await service.updateComposition(DECK_ID, USER_ID, dto);

      // deck_card rows are legitimately deleted+reinserted (steps 2-3); what
      // must never happen is a delete targeting swap suggestion data.
      const deleteCalls = (manager.delete as jest.Mock).mock.calls;
      for (const call of deleteCalls) {
        expect(call[0]).not.toBe('swap_suggestion');
      }
      expect(swapsReconciliationService.reconcile).toHaveBeenCalledTimes(1);
    });
  });
});
