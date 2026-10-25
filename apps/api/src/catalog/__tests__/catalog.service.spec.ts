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

    it('finds a card from Usurp the Shadow Throne, a recently released set', async () => {
      // Act
      const response = await service.search(USER_ID, 'usurp the shadow throne', 10);

      // Assert
      expect(response.results.map((r) => r.cardIdentifier)).toContain(
        'usurp-the-shadow-throne-blue',
      );
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

    it('(C3) projects imageUrl as the canonical small/large pair, dropping sources', async () => {
      // Act
      const response = await service.search(USER_ID, 'Snatch', 5);

      // Assert — every populated imageUrl carries exactly small + large
      // (the autocomplete row uses small as a 52×72 thumb; the lightbox
      // opens large). The catalog's `sources` mirror list is intentionally
      // dropped; on load failure the row falls back to <CardArt>.
      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        if (result.imageUrl !== null) {
          expect(Object.keys(result.imageUrl).sort()).toEqual(['large', 'small']);
          expect(typeof result.imageUrl.small).toBe('string');
          expect(typeof result.imageUrl.large).toBe('string');
        }
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
  describe('getVersionOptions', () => {
    interface IExpectedPrinting {
      readonly printingCode: string;
      readonly setName: string;
      readonly editions: readonly string[];
      readonly finishes: readonly string[];
    }

    it.each<[string, string, number, IExpectedPrinting]>([
      [
        'a card with a single printing',
        'back-for-seconds-yellow',
        1,
        { printingCode: 'DDD011', setName: 'Dorinthea Demo Deck', editions: [], finishes: ['none'] },
      ],
      [
        'a card whose printings name no edition',
        '10000-year-reunion-red',
        1,
        { printingCode: 'MST131', setName: 'Part the Mistveil', editions: [], finishes: ['none', 'rainbow'] },
      ],
      [
        'WTR167 on Snatch (Vermelho), in two editions and two finishes',
        'snatch-red',
        10,
        {
          printingCode: 'WTR167',
          setName: 'Welcome to Rathe',
          editions: ['unlimited', 'alpha'],
          finishes: ['none', 'rainbow'],
        },
      ],
    ])("version options come from the card's own printings: %s", (_label, cardIdentifier, printingCount, expected) => {
      const options = service.getVersionOptions(cardIdentifier);

      expect(options.cardIdentifier).toBe(cardIdentifier);
      expect(options.printings).toHaveLength(printingCount);
      const printing = options.printings.find((candidate) => candidate.printingCode === expected.printingCode);
      expect(printing).toBeDefined();
      expect(printing!.setName).toBe(expected.setName);
      expect(printing!.imageUrl?.small).toMatch(/^https?:\/\/.+\.webp$/);
      expect(printing!.editions).toEqual(expected.editions);
      expect(printing!.finishes).toEqual(expected.finishes);
      expect(new Set(options.printings.map((candidate) => candidate.printingCode)).size).toBe(printingCount);
    });

    it("version options come from the card's own printings: Snatch (Vermelho) lists no other card's code", () => {
      const codes = service.getVersionOptions('snatch-red').printings.map((printing) => printing.printingCode);

      expect(codes).toContain('WTR167');
      expect(codes).not.toContain('WTR168');
    });

    it('refuses a card that is not in the catalog', () => {
      expect(() => service.getVersionOptions('not-a-real-card')).toThrow(/does not exist/);
    });
  });
});
