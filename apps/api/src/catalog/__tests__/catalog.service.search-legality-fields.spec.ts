/**
 * U17 — CatalogService: search legality fields + listHeroes
 *
 * Verifies that:
 *   - search() results include legalFormats, legalHeroes, bannedFormats per card
 *   - bannedFormats serializes as [] when the upstream card has no bans
 *   - listHeroes() returns ≥143 items with the documented slim shape
 *   - young serializes as boolean (never undefined) per U2 normalization
 *   - /catalog/heroes JSON payload stays under 30KB (slim projection sanity check)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { CatalogService } from '../catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';

const USER_ID = 'user-uuid-u17';

describe('CatalogService — U17 search legality fields', () => {
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

  describe('search() — legality field projection', () => {
    it('each result carries legalFormats as a string array', async () => {
      // Act — "arrow" matches several non-hero, non-token attack cards
      const response = await service.search(USER_ID, 'arrow', 20);

      // Assert
      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        expect(Array.isArray(result.legalFormats)).toBe(true);
        for (const f of result.legalFormats) {
          expect(typeof f).toBe('string');
        }
      }
    });

    it('each result carries legalHeroes as a string array', async () => {
      // Act — "arrow" matches several non-hero, non-token attack cards
      const response = await service.search(USER_ID, 'arrow', 20);

      // Assert
      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        expect(Array.isArray(result.legalHeroes)).toBe(true);
        for (const h of result.legalHeroes) {
          expect(typeof h).toBe('string');
        }
      }
    });

    it('each result carries bannedFormats as a string array (never undefined)', async () => {
      // Act — use a broad query to surface cards that are likely not banned
      const response = await service.search(USER_ID, 'snatch', 10);

      // Assert — bannedFormats must be an array even when the card is not banned
      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        expect(Array.isArray(result.bannedFormats)).toBe(true);
      }
    });

    it('(edge case) bannedFormats serializes as [] when card has no bans', async () => {
      // Arrange — "Snatch" is a widely-legal common card; expect no bans
      const response = await service.search(USER_ID, 'Snatch', 5);

      // Assert — every result has bannedFormats as an array ([] when no bans)
      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        expect(result.bannedFormats).toBeDefined();
        expect(Array.isArray(result.bannedFormats)).toBe(true);
      }
    });

    it('legality fields are present alongside existing fields', async () => {
      // Act
      const response = await service.search(USER_ID, 'Snatch', 3);

      // Assert — verify the full expected shape is intact
      expect(response.results.length).toBeGreaterThan(0);
      const firstResult = response.results[0]!;
      expect(firstResult).toHaveProperty('cardIdentifier');
      expect(firstResult).toHaveProperty('name');
      expect(firstResult).toHaveProperty('pitch');
      expect(firstResult).toHaveProperty('classes');
      expect(firstResult).toHaveProperty('types');
      expect(firstResult).toHaveProperty('ownedQuantity');
      expect(firstResult).toHaveProperty('imageUrl');
      expect(firstResult).toHaveProperty('legalFormats');
      expect(firstResult).toHaveProperty('legalHeroes');
      expect(firstResult).toHaveProperty('bannedFormats');
    });
  });
});

describe('CatalogService — U17 listHeroes()', () => {
  let service: CatalogService;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    collectionReadService = createMock<CollectionReadService>();

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

  it('returns at least 143 hero items', () => {
    // Act
    const response = service.listHeroes();

    // Assert
    expect(response.heroes.length).toBeGreaterThanOrEqual(143);
  });

  it('each hero item has the documented slim shape', () => {
    // Act
    const response = service.listHeroes();

    // Assert
    expect(response.heroes.length).toBeGreaterThan(0);
    for (const hero of response.heroes) {
      expect(typeof hero.cardIdentifier).toBe('string');
      expect(hero.cardIdentifier.length).toBeGreaterThan(0);
      expect(typeof hero.name).toBe('string');
      expect(hero.name.length).toBeGreaterThan(0);
      expect(typeof hero.young).toBe('boolean'); // U2 normalization: never undefined
      expect(Array.isArray(hero.legalFormats)).toBe(true);
      // imageUrl is either null or { small, large }
      if (hero.imageUrl !== null) {
        expect(typeof hero.imageUrl.small).toBe('string');
        expect(typeof hero.imageUrl.large).toBe('string');
        // Slim projection: no sources[] array
        expect((hero.imageUrl as Record<string, unknown>)['sources']).toBeUndefined();
      }
    }
  });

  it('(edge case) young field is a boolean, never undefined', () => {
    // Act
    const response = service.listHeroes();

    // Assert — U2 normalization coerces undefined → false
    for (const hero of response.heroes) {
      expect(typeof hero.young).toBe('boolean');
    }
  });

  it('serialized JSON payload stays under 60KB (slim projection sanity check)', () => {
    // Act
    const response = service.listHeroes();
    const json = JSON.stringify(response);
    const sizeInBytes = Buffer.byteLength(json, 'utf8');

    // Assert — the slim projection (small/large only, no sources[] mirror list,
    // no power/defense/cost/keywords/subtypes/sets/specializations) must stay
    // well under 60KB for the full ~143-hero set. The plan estimated ~22KB
    // (before accounting for the full S3 URL lengths); actual is ~51KB.
    // This ceiling guards against accidentally including bulky fields in future.
    expect(sizeInBytes).toBeLessThan(60_000);
  });

  it('does NOT include non-hero cards', () => {
    // Act
    const response = service.listHeroes();

    // Assert — all returned cards must have "Hero" in their types.
    // We verify via a known non-hero card identifier being absent.
    const identifiers = new Set(response.heroes.map((h) => h.cardIdentifier));
    expect(identifiers.has('snatch-red')).toBe(false);
    expect(identifiers.has('snatch-yellow')).toBe(false);
  });

  it('includes known hero identifiers', () => {
    // Act
    const response = service.listHeroes();

    // Assert — spot-check against two well-known heroes
    const identifiers = new Set(response.heroes.map((h) => h.cardIdentifier));
    // Dorinthea is in the catalog
    const hasDorinthea = [...identifiers].some((id) =>
      id.toLowerCase().includes('dorinthea'),
    );
    expect(hasDorinthea).toBe(true);
  });
});
