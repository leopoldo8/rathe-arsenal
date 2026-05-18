import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { VariantFetchService } from '../../stores/variant-fetch.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DecksService } from '../decks.service';
import { CreateScratchDeckDto } from '../dto/create-scratch-deck.dto';

const USER_ID = 'user-uuid-scratch';

function buildSavedDeck(overrides: Partial<TrackedDeckEntity> = {}): TrackedDeckEntity {
  return {
    id: 42,
    userId: USER_ID,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    status: 'idea',
    trackedAt: new Date('2026-05-17T10:00:00Z'),
    updatedAt: new Date('2026-05-17T10:00:00Z'),
    user: {} as TrackedDeckEntity['user'],
    ...overrides,
  };
}

function buildCatalogCard(overrides: {
  cardIdentifier?: string;
  name?: string;
  types?: string[];
} = {}) {
  return {
    cardIdentifier: overrides.cardIdentifier ?? 'dorinthea-ironsong',
    name: overrides.name ?? 'Dorinthea Ironsong',
    types: overrides.types ?? ['Hero'],
    classes: [],
    talents: [],
    pitch: null,
    power: null,
    defense: null,
    cost: null,
    keywords: [],
    subtypes: [],
    legalHeroes: [],
    legalFormats: ['Classic Constructed', 'Blitz'],
    bannedFormats: [],
    rarity: 'Token',
    young: false,
    sets: ['WTR'],
    imageUrl: null,
    hero: 'Dorinthea',
  };
}

describe('DecksService.createScratch', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;
  let variantFetchService: jest.Mocked<VariantFetchService>;
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
    variantFetchService = createMock<VariantFetchService>();
    decisionsService = createMock<DecisionsService>();
    catalogService = createMock<CatalogService>();
    collectionReadService = createMock<CollectionReadService>();

    shoppingLineService.computeForBreakdown.mockResolvedValue(null);
    shoppingLineService.computeAggregate.mockResolvedValue(null);
    variantFetchService.getProgress.mockReturnValue(undefined);
    collectionReadService.countUniqueOwned.mockResolvedValue(0);
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.list.mockResolvedValue([]);
    decisionsService.loadExclusions.mockResolvedValue(new Set());

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
        { provide: VariantFetchService, useValue: variantFetchService },
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

  function setupTransaction(savedDeck: TrackedDeckEntity): void {
    const manager = createMock<EntityManager>();
    manager.create.mockReturnValue(savedDeck as unknown as ReturnType<EntityManager['create']>);
    manager.save.mockResolvedValue(savedDeck as unknown as ReturnType<EntityManager['save']>);
    // Simulate dataSource.transaction by calling the callback with the manager.
    // Cast to `any` to bypass TypeORM's overloaded `transaction` signature.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
      async (cb: (manager: EntityManager) => Promise<TrackedDeckEntity>) => cb(manager),
    );
  }

  describe('happy path — Dorinthea CC', () => {
    it('returns 201-compatible payload with status=idea, fabraryUlid=null, totalCards=0', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved = buildSavedDeck();
      setupTransaction(saved);
      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      const result = await service.createScratch(USER_ID, dto);

      // Assert
      expect(result.fabraryUlid).toBeNull();
      expect(result.totalCards).toBe(0);
      expect(result.decisions).toEqual([]);
      expect(result.rejectedCount).toBe(0);
      expect(result.approvedCount).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.latestSnapshot).toBeNull();
    });

    it('composes name as "{heroDisplayName} — {format}"', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved = buildSavedDeck({ name: 'Dorinthea Ironsong — Classic Constructed' });
      setupTransaction(saved);
      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      const result = await service.createScratch(USER_ID, dto);

      // Assert — name is the composed value persisted in the DB
      expect(result.name).toBe('Dorinthea Ironsong — Classic Constructed');
    });

    it('includes legality with category=incomplete for a 0-card deck', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved = buildSavedDeck();
      setupTransaction(saved);
      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      const result = await service.createScratch(USER_ID, dto);

      // Assert — legality must be present and incomplete for a 0-card deck
      expect(result.legality).toBeDefined();
      expect(result.legality?.category).toBe('incomplete');
      expect(result.legality?.reasons.length).toBeGreaterThan(0);
    });

    it('returns heroIdentifier from saved entity', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved = buildSavedDeck();
      setupTransaction(saved);
      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      const result = await service.createScratch(USER_ID, dto);

      // Assert
      expect(result.id).toBe(42);
      expect(result.hero).toBe('Dorinthea Ironsong');
      expect(result.format).toBe('Classic Constructed');
    });

    it('persists the deck with status=idea and fabraryUlid=null inside a transaction', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved = buildSavedDeck();
      const manager = createMock<EntityManager>();
      manager.create.mockReturnValue(saved as unknown as ReturnType<EntityManager['create']>);
      manager.save.mockResolvedValue(saved as unknown as ReturnType<EntityManager['save']>);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
        async (cb: (manager: EntityManager) => Promise<TrackedDeckEntity>) => cb(manager),
      );
      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      await service.createScratch(USER_ID, dto);

      // Assert — transaction was used and manager.create received correct fields
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(
        TrackedDeckEntity,
        expect.objectContaining({
          userId: USER_ID,
          fabraryUlid: null,
          status: 'idea',
          heroIdentifier: 'dorinthea-ironsong',
          format: 'Classic Constructed',
        }),
      );
    });
  });

  describe('happy path — Briar Living Legend', () => {
    it('returns legality.category=incomplete for Briar in LL (0-card deck)', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'briar-warden-of-thorns',
        format: 'Living Legend',
      };
      const saved = buildSavedDeck({
        id: 43,
        name: 'Briar, Warden of Thorns — Living Legend',
        hero: 'Briar, Warden of Thorns',
        heroIdentifier: 'briar-warden-of-thorns',
        format: 'Living Legend',
      });
      setupTransaction(saved);
      catalogService.getCard.mockReturnValue(
        buildCatalogCard({
          cardIdentifier: 'briar-warden-of-thorns',
          name: 'Briar, Warden of Thorns',
          types: ['Hero'],
        }) as ReturnType<typeof catalogService.getCard>,
      );

      // Act
      const result = await service.createScratch(USER_ID, dto);

      // Assert — 0-card deck is always incomplete, not illegal
      expect(result.legality?.category).toBe('incomplete');
    });
  });

  describe('error paths', () => {
    it('throws NotFoundException when catalogService.getCard throws', async () => {
      // Arrange — heroIdentifier not in catalog
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'nonexistent-hero',
        format: 'Classic Constructed',
      };
      catalogService.getCard.mockImplementation(() => {
        throw new NotFoundException('Card not found');
      });

      // Act & Assert
      await expect(service.createScratch(USER_ID, dto)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('duplicate scratch deck (same hero+format)', () => {
    it('allows creating two decks with same hero+format (no unique constraint on null fabraryUlid)', async () => {
      // Arrange
      const dto: CreateScratchDeckDto = {
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
      };
      const saved1 = buildSavedDeck({ id: 44 });
      const saved2 = buildSavedDeck({ id: 45 });

      const manager = createMock<EntityManager>();
      let callCount = 0;
      manager.create.mockReturnValue(saved1 as unknown as ReturnType<EntityManager['create']>);
      manager.save.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? saved1 : saved2;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
        async (cb: (manager: EntityManager) => Promise<TrackedDeckEntity>) => cb(manager),
      );

      catalogService.getCard.mockReturnValue(
        buildCatalogCard() as ReturnType<typeof catalogService.getCard>,
      );

      // Act — both calls should succeed
      const result1 = await service.createScratch(USER_ID, dto);
      manager.create.mockReturnValue(saved2 as unknown as ReturnType<EntityManager['create']>);
      const result2 = await service.createScratch(USER_ID, dto);

      // Assert
      expect(result1.id).toBe(44);
      expect(result2.id).toBe(45);
      expect(result1.fabraryUlid).toBeNull();
      expect(result2.fabraryUlid).toBeNull();
    });
  });
});
