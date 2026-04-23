import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { CatalogService } from '../catalog.service';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../../collection/collection-read.service';

const USER_ID = 'user-uuid-123';

describe('CatalogService', () => {
  let service: CatalogService;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    collectionReadService = createMock<CollectionReadService>();
    collectionReadService.loadOwned.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: CollectionReadService,
          useValue: collectionReadService,
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getCards returns the full catalog', () => {
    const cards = service.getCards();
    expect(cards.length).toBeGreaterThan(4000);
  });

  it('getCard returns a known card', () => {
    const card = service.getCard('snatch-red');
    expect(card.cardIdentifier).toBe('snatch-red');
    expect(card.name).toBe('Snatch');
  });

  it('getCard throws CardNotFoundError for unknown card', () => {
    expect(() => service.getCard('not-a-real-card')).toThrow(CardNotFoundError);
  });

  it('getIndices returns populated indices', () => {
    const indices = service.getIndices();
    expect(indices.byIdentifier.size).toBeGreaterThan(0);
    expect(indices.byClassAndPitch.size).toBeGreaterThan(0);
    expect(indices.byTypeAndClass.size).toBeGreaterThan(0);
  });

  it('getRawCard returns the raw object with printings', () => {
    const raw = service.getRawCard('snatch-red') as Record<string, unknown>;
    expect(raw.cardIdentifier).toBe('snatch-red');
    expect(raw.printings).toBeDefined();
  });

  describe('search', () => {
    it('returns cards whose name starts with the query (case-insensitive)', async () => {
      // Arrange
      collectionReadService.loadOwned.mockResolvedValue(new Map());

      // Act
      const response = await service.search(USER_ID, 'Snatch', 10);

      // Assert
      expect(response.results.length).toBeGreaterThan(0);
      expect(
        response.results.every((r) =>
          r.name.toLowerCase().includes('snatch'),
        ),
      ).toBe(true);
      expect(response.results.some((r) => r.name === 'Snatch')).toBe(true);
    });

    it('respects the limit parameter', async () => {
      // Act
      const response = await service.search(USER_ID, 'a', 3);

      // Assert — note: q length 1 is blocked at DTO layer, but the service
      // defensively enforces the limit regardless of what lands here.
      expect(response.results.length).toBeLessThanOrEqual(3);
    });

    it('defaults limit to 10 when not provided', async () => {
      // Act
      const response = await service.search(USER_ID, 'of');

      // Assert
      expect(response.results.length).toBeLessThanOrEqual(10);
    });

    it('excludes cards of type Hero from results', async () => {
      // Arrange — real catalog has many heroes, use a known hero prefix
      const response = await service.search(USER_ID, 'Dorinthea', 20);

      // Assert
      expect(
        response.results.every((r) => !r.types.includes('Hero')),
      ).toBe(true);
    });

    it('returns empty results array when no card matches', async () => {
      // Act
      const response = await service.search(
        USER_ID,
        'zzznotarealcardnamexxx',
        10,
      );

      // Assert
      expect(response.results).toEqual([]);
      expect(collectionReadService.loadOwned).not.toHaveBeenCalled();
    });

    it('populates ownedQuantity from the user collection', async () => {
      // Arrange — pick a real card identifier and fake it as owned
      const OWNED_ID = 'snatch-red';
      collectionReadService.loadOwned.mockResolvedValue(new Map([[OWNED_ID, 3]]));

      // Act
      const response = await service.search(USER_ID, 'Snatch', 10);

      // Assert
      const owned = response.results.find(
        (r) => r.cardIdentifier === OWNED_ID,
      );
      expect(owned).toBeDefined();
      expect(owned?.ownedQuantity).toBe(3);
      // Other results default to 0
      const nonOwned = response.results.find(
        (r) => r.cardIdentifier !== OWNED_ID,
      );
      if (nonOwned) {
        expect(nonOwned.ownedQuantity).toBe(0);
      }
    });

    it('scopes ownedQuantity lookup to the requesting user', async () => {
      // Act
      await service.search(USER_ID, 'Snatch', 10);

      // Assert — loadOwned is called with userId and the matched identifiers
      expect(collectionReadService.loadOwned).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Array),
      );
    });

    it('fills remaining slots via includes fallback after startsWith', async () => {
      // Use a common substring appearing mid-name for many cards.
      // "heart" appears at the start of some cards and inside others.
      const response = await service.search(USER_ID, 'heart', 10);

      // Assert
      expect(response.results.length).toBeGreaterThan(0);
      for (const r of response.results) {
        expect(r.name.toLowerCase()).toContain('heart');
      }
    });
  });
});
