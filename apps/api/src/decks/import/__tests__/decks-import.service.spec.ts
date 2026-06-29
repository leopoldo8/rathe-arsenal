import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FabraryService } from '../../../fabrary/fabrary.service';
import { SubstitutionService } from '../../../substitution/substitution.service';
import { SourcesService } from '../../../collection/sources/sources.service';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../../database/entities/deck-readiness-snapshot.entity';
import { IDeckImportDto } from '../../../fabrary/dtos/deck-import.dto';
import { FabraryImportError, EFabraryErrorCode } from '../../../fabrary/errors';
import { DecksImportService } from '../decks-import.service';
import { ImportDecksRequestDto } from '../dtos/import-decks.request.dto';

const FABRARY_URL_1 = 'https://fabrary.net/decks/01H0000000000000000000AAAA';
const FABRARY_URL_2 = 'https://fabrary.net/decks/01H0000000000000000000BBBB';
const ULID_1 = '01H0000000000000000000AAAA';
const ULID_2 = '01H0000000000000000000BBBB';
const USER_ID = 'user-uuid-123';

function buildDeckFixture(ulid: string, name: string): IDeckImportDto {
  return {
    ulid,
    name,
    format: 'Classic Constructed',
    hero: { cardIdentifier: 'hero-001', name: 'Test Hero' },
    mainboard: [
      { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
      { cardIdentifier: 'sink-below', quantity: 2, slot: 'mainboard' },
    ],
    equipment: [
      { cardIdentifier: 'nullrune-hood', quantity: 1, slot: 'equipment' },
    ],
    weapons: [
      { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
    ],
    inventory: [],
  };
}

describe('DecksImportService', () => {
  let service: DecksImportService;
  let fabraryService: FabraryService;
  let substitutionService: SubstitutionService;
  let sourcesService: jest.Mocked<SourcesService>;
  let dataSource: DataSource;
  let mockManager: EntityManager;
  let mockTrackedDeckRepo: Repository<TrackedDeckEntity>;

  beforeEach(async () => {
    fabraryService = createMock<FabraryService>();
    substitutionService = createMock<SubstitutionService>();
    sourcesService = createMock<SourcesService>();
    mockManager = createMock<EntityManager>();
    mockTrackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    dataSource = createMock<DataSource>();

    // Default: transaction executes the callback with mockManager
    (dataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (manager: EntityManager) => Promise<unknown>) => cb(mockManager),
    );

    // Default: getRepository returns the mock tracked deck repo
    (dataSource.getRepository as jest.Mock).mockReturnValue(mockTrackedDeckRepo);

    // Default: no existing tracked decks
    (mockTrackedDeckRepo.findOne as jest.Mock).mockResolvedValue(null);

    // Default: sourcesService returns a manual source
    sourcesService.ensureManualSource.mockResolvedValue({
      id: 'manual-source-uuid-001',
      userId: USER_ID,
      kind: 'manual',
      label: 'Manual entries',
      originalFilename: null,
      sourceUrl: null,
      contentHash: null,
      cardCount: null,
      active: true,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      user: {} as never,
    });

    // Default: manager.create returns the input with an id
    let deckIdCounter = 100;
    (mockManager.create as jest.Mock).mockImplementation(
      (_entity: unknown, data: Record<string, unknown>) => ({
        ...data,
        id: ++deckIdCounter,
      }),
    );

    // Default: manager.save returns the input as-is
    (mockManager.save as jest.Mock).mockImplementation(
      (_entity: unknown, data: unknown) => Promise.resolve(data),
    );

    // Default: manager.findOne returns null (no existing collection cards)
    (mockManager.findOne as jest.Mock).mockResolvedValue(null);

    // Default: manager.update resolves
    (mockManager.update as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksImportService,
        { provide: DataSource, useValue: dataSource },
        { provide: FabraryService, useValue: fabraryService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: SourcesService, useValue: sourcesService },
      ],
    }).compile();

    service = module.get(DecksImportService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should import a single deck successfully', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = { urls: [FABRARY_URL_1] };
    const deckFixture = buildDeckFixture(ULID_1, 'My Deck');

    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue(deckFixture);

    const snapshotFixture: Partial<DeckReadinessSnapshotEntity> = {
      rawPercent: 75.5,
      effectivePercent: 82.3,
    };
    (substitutionService.computeAndStoreReadiness as jest.Mock).mockResolvedValue(
      snapshotFixture,
    );

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]!.name).toBe('My Deck');
    expect(result.imported[0]!.hero).toBe('Test Hero');
    expect(result.imported[0]!.format).toBe('Classic Constructed');
    expect(result.imported[0]!.readinessSnapshot).toEqual({
      rawPercent: 75.5,
      effectivePercent: 82.3,
    });
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    expect(fabraryService.fetchDeck).toHaveBeenCalledWith(ULID_1);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalled();

    // U1: heroIdentifier must be set from the Fabrary GraphQL hero.cardIdentifier
    // field — not from the display name — so the legality engine can resolve it.
    const createCalls = (mockManager.create as jest.Mock).mock.calls as unknown[][];
    const trackedDeckCreateCall = createCalls.find(
      (call) => call[0] === TrackedDeckEntity,
    );
    expect(trackedDeckCreateCall).toBeDefined();
    expect(trackedDeckCreateCall![1]).toMatchObject({
      heroIdentifier: 'hero-001',
    });
  });

  it('should skip duplicate URLs within the same request', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = {
      urls: [FABRARY_URL_1, FABRARY_URL_1],
    };
    const deckFixture = buildDeckFixture(ULID_1, 'My Deck');

    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue(deckFixture);
    (substitutionService.computeAndStoreReadiness as jest.Mock).mockResolvedValue({
      rawPercent: 80,
      effectivePercent: 85,
    });

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.url).toBe(FABRARY_URL_1);
    expect(result.skipped[0]!.reason).toBe('DUPLICATE_IN_REQUEST');
    expect(fabraryService.fetchDeck).toHaveBeenCalledTimes(1);
  });

  it('should skip already-tracked decks', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = { urls: [FABRARY_URL_1] };
    const deckFixture = buildDeckFixture(ULID_1, 'Already Tracked');

    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue(deckFixture);
    (mockTrackedDeckRepo.findOne as jest.Mock).mockResolvedValue({
      id: 42,
      userId: USER_ID,
      fabraryUlid: ULID_1,
    });

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toBe('ALREADY_TRACKED');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should handle FabraryService failure as a partial success', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = {
      urls: [FABRARY_URL_1, FABRARY_URL_2],
    };
    const deckFixture = buildDeckFixture(ULID_2, 'Good Deck');

    (fabraryService.fetchDeck as jest.Mock)
      .mockRejectedValueOnce(
        new FabraryImportError(EFabraryErrorCode.FETCH_FAILED, 'Network error'),
      )
      .mockResolvedValueOnce(deckFixture);

    (substitutionService.computeAndStoreReadiness as jest.Mock).mockResolvedValue({
      rawPercent: 90,
      effectivePercent: 92,
    });

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]!.name).toBe('Good Deck');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.url).toBe(FABRARY_URL_1);
    expect(result.errors[0]!.code).toBe(EFabraryErrorCode.FETCH_FAILED);
  });

  it('should return null readinessSnapshot when engine fails after commit', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = { urls: [FABRARY_URL_1] };
    const deckFixture = buildDeckFixture(ULID_1, 'My Deck');

    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue(deckFixture);
    (substitutionService.computeAndStoreReadiness as jest.Mock).mockRejectedValue(
      new Error('Engine exploded'),
    );

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]!.readinessSnapshot).toBeNull();
    expect(result.imported[0]!.name).toBe('My Deck');
    expect(result.errors).toHaveLength(0);
  });
});
