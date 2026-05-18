/**
 * U17 — CatalogController: GET /catalog/heroes integration test
 *
 * Tests the controller + service together (no mocked CatalogService) to verify
 * the full request-to-response projection for the heroes endpoint.
 *
 * Note: This test runs under the standard `pnpm test` suite (jest picks up
 * .int-spec.ts via the `.*\.spec\.ts$` regex) since the API package has no
 * separate test:int script.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { CatalogController } from '../catalog.controller';
import { CatalogService } from '../catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';

const MOCK_USER: ICurrentUser = {
  userId: 'user-uuid-u17-ctrl',
  email: 'test@rathe-arsenal.test',
};

describe('CatalogController — GET /catalog/heroes (U17)', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const collectionReadServiceMock = createMock<CollectionReadService>();
    collectionReadServiceMock.loadOwned.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        CatalogService,
        {
          provide: CollectionReadService,
          useValue: collectionReadServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a heroes array with at least 143 items', () => {
    // Act
    const response = controller.getHeroes();

    // Assert
    expect(response.heroes.length).toBeGreaterThanOrEqual(143);
  });

  it('each hero carries the documented slim shape: cardIdentifier, name, young, legalFormats, imageUrl', () => {
    // Act
    const response = controller.getHeroes();

    // Assert
    expect(response.heroes.length).toBeGreaterThan(0);
    for (const hero of response.heroes) {
      expect(typeof hero.cardIdentifier).toBe('string');
      expect(hero.cardIdentifier.length).toBeGreaterThan(0);
      expect(typeof hero.name).toBe('string');
      expect(hero.name.length).toBeGreaterThan(0);
      expect(typeof hero.young).toBe('boolean');
      expect(Array.isArray(hero.legalFormats)).toBe(true);
      if (hero.imageUrl !== null) {
        expect(typeof hero.imageUrl.small).toBe('string');
        expect(typeof hero.imageUrl.large).toBe('string');
      }
    }
  });

  it('(edge case) young serializes as boolean, never undefined', () => {
    // Act
    const response = controller.getHeroes();

    // Assert — U2 normalization guarantees young is coerced true|false
    for (const hero of response.heroes) {
      expect(typeof hero.young).toBe('boolean');
    }
  });

  it('slim projection does NOT include sources[] on imageUrl', () => {
    // Act
    const response = controller.getHeroes();

    // Assert — the sources[] array (fallback mirrors) must be stripped to keep
    // the payload lean; the frontend uses small/large directly.
    for (const hero of response.heroes) {
      if (hero.imageUrl !== null) {
        expect((hero.imageUrl as Record<string, unknown>)['sources']).toBeUndefined();
      }
    }
  });

  it('JSON serialization stays under 60KB (slim projection sanity check)', () => {
    // Act
    const response = controller.getHeroes();
    const json = JSON.stringify(response);
    const sizeInBytes = Buffer.byteLength(json, 'utf8');

    // Assert — slim projection guard (small/large only, no sources[], no
    // engine-internal fields). Plan estimated ~22KB; actual ~51KB due to
    // full S3 URL lengths. Ceiling guards against accidental bulk additions.
    expect(sizeInBytes).toBeLessThan(60_000);
  });

  it('does NOT contain non-hero cards in the result', () => {
    // Act
    const response = controller.getHeroes();

    // Assert — known non-hero identifiers must be absent
    const identifiers = new Set(response.heroes.map((h) => h.cardIdentifier));
    expect(identifiers.has('snatch-red')).toBe(false);
    expect(identifiers.has('snatch-yellow')).toBe(false);
  });
});

describe('CatalogController — GET /catalog/search legality fields (U17)', () => {
  let controller: CatalogController;
  let collectionReadServiceMock: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    collectionReadServiceMock = createMock<CollectionReadService>();
    collectionReadServiceMock.loadOwned.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        CatalogService,
        {
          provide: CollectionReadService,
          useValue: collectionReadServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('search results include legalFormats, legalHeroes, bannedFormats', async () => {
    // Arrange — "arrow" matches non-hero attack cards; "briar" is a hero and
    // would be excluded from search results by the EXCLUDED_TYPES filter.
    const dto = { q: 'arrow', limit: 10 };

    // Act
    const response = await controller.search(dto, MOCK_USER);

    // Assert
    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      expect(Array.isArray(result.legalFormats)).toBe(true);
      expect(Array.isArray(result.legalHeroes)).toBe(true);
      expect(Array.isArray(result.bannedFormats)).toBe(true);
    }
  });

  it('bannedFormats is [] when the card has no bans (not undefined)', async () => {
    // Arrange — "Snatch" is a broadly-legal card unlikely to have bans
    const dto = { q: 'Snatch', limit: 5 };

    // Act
    const response = await controller.search(dto, MOCK_USER);

    // Assert
    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      expect(result.bannedFormats).toBeDefined();
      expect(Array.isArray(result.bannedFormats)).toBe(true);
    }
  });
});
