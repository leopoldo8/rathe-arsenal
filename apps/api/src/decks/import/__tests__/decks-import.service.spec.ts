import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FabraryService } from '../../../fabrary/fabrary.service';
import { SubstitutionService } from '../../../substitution/substitution.service';
import { CollectionReadService } from '../../../collection/collection-read.service';
import { ImportWriterService } from '../../../collection/imports/import-writer.service';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../../database/entities/deck-card.entity';
import { IDeckImportDto } from '../../../fabrary/dtos/deck-import.dto';
import { FabraryImportError, EFabraryErrorCode } from '../../../fabrary/errors';
import { DecksImportService } from '../decks-import.service';
import { ImportDecksRequestDto } from '../dtos/import-decks.request.dto';
import { RecommendationQueueService } from '../../../recommendations/recommendation-queue.service';

const FABRARY_URL_1 = 'https://fabrary.net/decks/01H0000000000000000000AAAA';
const ULID_1 = '01H0000000000000000000AAAA';
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
  let importWriter: jest.Mocked<ImportWriterService>;
  let collectionRead: jest.Mocked<CollectionReadService>;
  let dataSource: DataSource;
  let mockManager: EntityManager;
  let mockTrackedDeckRepo: Repository<TrackedDeckEntity>;

  beforeEach(async () => {
    fabraryService = createMock<FabraryService>();
    substitutionService = createMock<SubstitutionService>();
    importWriter = createMock<ImportWriterService>();
    collectionRead = createMock<CollectionReadService>();
    mockManager = createMock<EntityManager>();
    mockTrackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    dataSource = createMock<DataSource>();

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (manager: EntityManager) => Promise<unknown>) => cb(mockManager),
    );
    (dataSource.getRepository as jest.Mock).mockReturnValue(mockTrackedDeckRepo);
    (mockTrackedDeckRepo.findOne as jest.Mock).mockResolvedValue(null);
    (mockTrackedDeckRepo.find as jest.Mock).mockResolvedValue([]);
    importWriter.createImport.mockImplementation(async (_manager, input) => ({
      id: 'fabrary-source-uuid-001',
      userId: input.userId,
      kind: input.kind,
      label: input.label,
    }) as never);

    let deckIdCounter = 100;
    (mockManager.create as jest.Mock).mockImplementation(
      (_entity: unknown, data: Record<string, unknown>) => ({ ...data, id: ++deckIdCounter }),
    );
    (mockManager.save as jest.Mock).mockImplementation(
      (_entity: unknown, data: unknown) => Promise.resolve(data),
    );
    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue(buildDeckFixture(ULID_1, 'My Deck'));
    (substitutionService.computeAndStoreReadiness as jest.Mock).mockResolvedValue({ rawPercent: 50, effectivePercent: 50 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksImportService,
        { provide: DataSource, useValue: dataSource },
        { provide: FabraryService, useValue: fabraryService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ImportWriterService, useValue: importWriter },
        { provide: CollectionReadService, useValue: collectionRead },
        { provide: RecommendationQueueService, useValue: createMock<RecommendationQueueService>() },
      ],
    }).compile();

    service = module.get(DecksImportService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it('the ownership answer has no default', async () => {
    // Arrange
    const dto = { text: FABRARY_URL_1 } as unknown as ImportDecksRequestDto;

    // Act
    const run = service.run(dto, { userId: USER_ID });

    // Assert
    await expect(run).rejects.toBeInstanceOf(BadRequestException);
    expect(fabraryService.fetchDeck).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(importWriter.createImport).not.toHaveBeenCalled();
  });

  it('imports the deck of the first link in the text and keeps heroIdentifier from the hero card', async () => {
    // Arrange
    const dto: ImportDecksRequestDto = { text: `olha esse deck ${FABRARY_URL_1}/ valeu`, ownsCards: false };

    // Act
    const result = await service.run(dto, { userId: USER_ID });

    // Assert
    expect(result).toEqual({ deckId: 101 });
    expect(fabraryService.fetchDeck).toHaveBeenCalledWith(ULID_1);
    const createCalls = (mockManager.create as jest.Mock).mock.calls as unknown[][];
    const trackedDeckCreateCall = createCalls.find((call) => call[0] === TrackedDeckEntity);
    expect(trackedDeckCreateCall![1]).toMatchObject({ heroIdentifier: 'hero-001', name: 'My Deck' });
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(101, USER_ID);
  });

  it('answering no writes no import and leaves the other decks alone', async () => {
    // Arrange
    (mockTrackedDeckRepo.find as jest.Mock).mockResolvedValue([{ id: 7, userId: USER_ID }]);

    // Act
    const result = await service.run({ text: FABRARY_URL_1, ownsCards: false }, { userId: USER_ID });

    // Assert
    expect(result.source).toBeUndefined();
    expect(importWriter.createImport).not.toHaveBeenCalled();
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(1);
  });

  it('answering yes writes one fabrary import with the deck and inventory copies and recomputes the other decks', async () => {
    // Arrange
    (mockTrackedDeckRepo.find as jest.Mock).mockResolvedValue([{ id: 7, userId: USER_ID }, { id: 8, userId: USER_ID }]);
    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue({
      ...buildDeckFixture(ULID_1, 'My Deck'),
      mainboard: [{ cardIdentifier: 'snatch-red', quantity: 2, slot: 'mainboard' }],
      inventory: [{ cardIdentifier: 'snatch-red', quantity: 1, slot: 'mainboard' }],
    });

    // Act
    const result = await service.run({ text: FABRARY_URL_1, ownsCards: true }, { userId: USER_ID });

    // Assert
    expect(importWriter.createImport).toHaveBeenCalledTimes(1);
    const input = importWriter.createImport.mock.calls[0]![1];
    expect(input).toMatchObject({ userId: USER_ID, kind: 'fabrary', label: 'Fabrary: My Deck', pending: [] });
    expect(input.copies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardIdentifier: 'snatch-red', quantity: 3 }),
        expect.objectContaining({ cardIdentifier: 'hero-001', quantity: 1 }),
      ]),
    );
    expect(result.source).toMatchObject({ id: 'fabrary-source-uuid-001', kind: 'fabrary', label: 'Fabrary: My Deck' });
    const recomputed = (substitutionService.computeAndStoreReadiness as jest.Mock).mock.calls as unknown[][];
    expect(recomputed).toEqual(expect.arrayContaining([[7, USER_ID], [8, USER_ID]]));
  });

  it('sideboardQuantity is stored as the inventory quantity', async () => {
    // Arrange
    // Fabrary's "Inventory" arrives as separate entries: a card at 2 in the deck and 1 in the
    // inventory, and a card with no deck copy and 3 in the inventory.
    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue({
      ...buildDeckFixture(ULID_1, 'Deck with inventory'),
      mainboard: [{ cardIdentifier: 'snatch-red', quantity: 2, slot: 'mainboard' }],
      equipment: [],
      weapons: [],
      inventory: [
        { cardIdentifier: 'snatch-red', quantity: 1, slot: 'mainboard' },
        { cardIdentifier: 'sink-below', quantity: 3, slot: 'mainboard' },
      ],
    } satisfies IDeckImportDto);

    // Act
    await service.run({ text: FABRARY_URL_1, ownsCards: false }, { userId: USER_ID });

    // Assert
    const createCalls = (mockManager.create as jest.Mock).mock.calls as unknown[][];
    const lines = createCalls
      .filter((call) => call[0] === DeckCardEntity)
      .map((call) => call[1] as { cardIdentifier: string; slot: string; quantity: number; inventoryQuantity: number });
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardIdentifier: 'snatch-red', slot: 'mainboard', quantity: 2, inventoryQuantity: 1 }),
        expect.objectContaining({ cardIdentifier: 'sink-below', slot: 'mainboard', quantity: 0, inventoryQuantity: 3 }),
        expect.objectContaining({ cardIdentifier: 'hero-001', slot: 'hero', quantity: 1, inventoryQuantity: 0 }),
      ]),
    );
  });

  it('answers with the existing deck and writes nothing for a deck already tracked', async () => {
    // Arrange
    (mockTrackedDeckRepo.findOne as jest.Mock).mockResolvedValue({ id: 42, userId: USER_ID, fabraryUlid: ULID_1 });

    // Act
    const result = await service.run({ text: FABRARY_URL_1, ownsCards: true }, { userId: USER_ID });

    // Assert
    expect(result).toEqual({ deckId: 42 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('answers 404 for a missing or private deck and 502 when Fabrary cannot be reached', async () => {
    // Arrange
    (fabraryService.fetchDeck as jest.Mock)
      .mockRejectedValueOnce(new FabraryImportError(EFabraryErrorCode.INVALID_PAYLOAD, 'GraphQL response missing getDeck data'))
      .mockRejectedValueOnce(new FabraryImportError(EFabraryErrorCode.FETCH_FAILED, 'timeout'));

    // Act and Assert
    await expect(service.run({ text: FABRARY_URL_1, ownsCards: true }, { userId: USER_ID })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.run({ text: FABRARY_URL_1, ownsCards: true }, { userId: USER_ID })).rejects.toBeInstanceOf(BadGatewayException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('answers 400 for a text with no Fabrary link', async () => {
    // Act
    const run = service.run({ text: '3x Snatch (Red)', ownsCards: true }, { userId: USER_ID });

    // Assert
    await expect(run).rejects.toBeInstanceOf(BadRequestException);
    expect(fabraryService.fetchDeck).not.toHaveBeenCalled();
  });

  it('keeps the import when the readiness computation fails after the commit', async () => {
    // Arrange
    (substitutionService.computeAndStoreReadiness as jest.Mock).mockRejectedValue(new Error('Engine exploded'));

    // Act
    const result = await service.run({ text: FABRARY_URL_1, ownsCards: false }, { userId: USER_ID });

    // Assert
    expect(result).toEqual({ deckId: 101 });
  });

  it('previews the deck with how many of its copies the collection holds and writes nothing', async () => {
    // Arrange
    (fabraryService.fetchDeck as jest.Mock).mockResolvedValue({
      ...buildDeckFixture(ULID_1, 'My Deck'),
      mainboard: [{ cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' }],
      equipment: [],
      weapons: [],
      inventory: [{ cardIdentifier: 'snatch-red', quantity: 1, slot: 'mainboard' }],
    } satisfies IDeckImportDto);
    collectionRead.loadOwned.mockResolvedValue(new Map([['snatch-red', 2]]));

    // Act
    const result = await service.preview(`olha ${FABRARY_URL_1}`, { userId: USER_ID });

    // Assert
    expect(result).toEqual({ name: 'My Deck', hero: 'Test Hero', format: 'Classic Constructed', totalCards: 5, ownedCards: 2 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
