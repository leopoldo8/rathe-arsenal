import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../../../database/entities/collection-card.entity';
import { FabraryService } from '../../../fabrary/fabrary.service';
import {
  EFabraryErrorCode,
  FabraryImportError,
} from '../../../fabrary/errors';
import {
  EFetchGuardErrorCode,
  FetchGuardError,
} from '../../../common/fetch-guard/errors';
import { IDeckImportDto } from '../../../fabrary/dtos/deck-import.dto';
import { TestDeckService } from '../test-deck.service';
import { TestDeckRequestDto } from '../dtos/test-deck.dto';
import { ShoppingLineService } from '../../../stores/shopping-line.service';

const FABRARY_URL = 'https://fabrary.net/decks/01H0000000000000000000AAAA';
const ULID = '01H0000000000000000000AAAA';
const USER_ID = 'user-uuid-xyz';

function buildDeckFixture(overrides: Partial<IDeckImportDto> = {}): IDeckImportDto {
  return {
    ulid: ULID,
    name: 'Test Deck',
    format: 'Classic Constructed',
    hero: { cardIdentifier: 'hero-001', name: 'Test Hero' },
    mainboard: [
      { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
      { cardIdentifier: 'sink-below-red', quantity: 2, slot: 'mainboard' },
    ],
    equipment: [
      { cardIdentifier: 'nullrune-hood', quantity: 1, slot: 'equipment' },
    ],
    weapons: [
      { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
    ],
    ...overrides,
  };
}

describe('TestDeckService', () => {
  let service: TestDeckService;
  let fabraryService: jest.Mocked<FabraryService>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;

  beforeEach(async () => {
    fabraryService = createMock<FabraryService>() as jest.Mocked<FabraryService>;
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>() as jest.Mocked<
      Repository<TrackedDeckEntity>
    >;
    collectionCardRepo = createMock<
      Repository<CollectionCardEntity>
    >() as jest.Mocked<Repository<CollectionCardEntity>>;
    shoppingLineService = createMock<ShoppingLineService>();

    // Default: user has no existing tracked deck for this URL
    (trackedDeckRepo.findOne as jest.Mock).mockResolvedValue(null);
    // Default: user has an empty collection
    (collectionCardRepo.find as jest.Mock).mockResolvedValue([]);
    // Default: shopping line returns null (Path A / no missing cards)
    shoppingLineService.computeForBreakdown.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDeckService,
        { provide: FabraryService, useValue: fabraryService },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
        { provide: ShoppingLineService, useValue: shoppingLineService },
      ],
    }).compile();

    service = module.get<TestDeckService>(TestDeckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy paths', () => {
    it('returns a readiness result without persisting anything', async () => {
      fabraryService.fetchDeck.mockResolvedValue(buildDeckFixture());

      const dto: TestDeckRequestDto = { url: FABRARY_URL };
      const result = await service.run(dto, { userId: USER_ID });

      expect(result).toBeDefined();
      expect(result.fabraryUlid).toBe(ULID);
      expect(result.name).toBe('Test Deck');
      expect(result.hero).toBe('Test Hero');
      expect(result.format).toBe('Classic Constructed');
      expect(result.alreadyTracked).toBe(false);
      expect(result.trackedDeckId).toBeNull();
      expect(['A', 'B', 'C']).toContain(result.path);
      expect(result.breakdown).toBeDefined();

      // Verify no writes happened
      expect(trackedDeckRepo.save).not.toHaveBeenCalled();
      expect(trackedDeckRepo.insert).not.toHaveBeenCalled();
      expect(collectionCardRepo.save).not.toHaveBeenCalled();
      expect(collectionCardRepo.insert).not.toHaveBeenCalled();
    });

    it('reports alreadyTracked=true when the user already tracks the deck', async () => {
      fabraryService.fetchDeck.mockResolvedValue(buildDeckFixture());
      (trackedDeckRepo.findOne as jest.Mock).mockResolvedValue({
        id: 42,
        userId: USER_ID,
        fabraryUlid: ULID,
      } as TrackedDeckEntity);

      const result = await service.run(
        { url: FABRARY_URL },
        { userId: USER_ID },
      );

      expect(result.alreadyTracked).toBe(true);
      expect(result.trackedDeckId).toBe(42);
      expect(trackedDeckRepo.save).not.toHaveBeenCalled();
    });

    it('fetches the user inventory but does not mutate it', async () => {
      fabraryService.fetchDeck.mockResolvedValue(buildDeckFixture());
      (collectionCardRepo.find as jest.Mock).mockResolvedValue([
        { cardIdentifier: 'snatch-red', quantity: 3 },
        { cardIdentifier: 'dawnblade', quantity: 1 },
      ]);

      await service.run({ url: FABRARY_URL }, { userId: USER_ID });

      expect(collectionCardRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(collectionCardRepo.save).not.toHaveBeenCalled();
      expect(collectionCardRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('Error paths', () => {
    it('rejects an invalid Fabrary URL with 400', async () => {
      await expect(
        service.run({ url: 'https://evil.example.com/decks/foo' }, { userId: USER_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(fabraryService.fetchDeck).not.toHaveBeenCalled();
    });

    it('rejects malformed URLs with 400', async () => {
      await expect(
        service.run({ url: 'not-a-url' }, { userId: USER_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps FetchGuardError HostDenied to 403', async () => {
      fabraryService.fetchDeck.mockRejectedValue(
        new FetchGuardError(EFetchGuardErrorCode.HostDenied, 'host not allowed'),
      );

      await expect(
        service.run({ url: FABRARY_URL }, { userId: USER_ID }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('maps FetchGuardError Timeout to 502 with FABRARY_TIMEOUT code', async () => {
      fabraryService.fetchDeck.mockRejectedValue(
        new FetchGuardError(EFetchGuardErrorCode.Timeout, 'timed out'),
      );

      let caught: BadGatewayException | null = null;
      try {
        await service.run({ url: FABRARY_URL }, { userId: USER_ID });
      } catch (error) {
        caught = error as BadGatewayException;
      }

      expect(caught).toBeInstanceOf(BadGatewayException);
      expect(caught?.getStatus()).toBe(502);
      const response = caught?.getResponse() as { code?: string };
      expect(response.code).toBe('FABRARY_TIMEOUT');
    });

    it('maps Fabrary fetch failures to 502', async () => {
      fabraryService.fetchDeck.mockRejectedValue(
        new FabraryImportError(EFabraryErrorCode.FETCH_FAILED, 'boom'),
      );

      await expect(
        service.run({ url: FABRARY_URL }, { userId: USER_ID }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('does not persist anything when fetch fails', async () => {
      fabraryService.fetchDeck.mockRejectedValue(
        new FabraryImportError(EFabraryErrorCode.FETCH_FAILED, 'boom'),
      );

      await service
        .run({ url: FABRARY_URL }, { userId: USER_ID })
        .catch(() => undefined);

      expect(trackedDeckRepo.save).not.toHaveBeenCalled();
      expect(collectionCardRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('SSRF regression', () => {
    it('source contains zero direct fetch( calls outside FetchGuardService', () => {
      const servicePath = path.join(
        __dirname,
        '..',
        'test-deck.service.ts',
      );
      const source = fs.readFileSync(servicePath, 'utf-8');
      // Strip block comments (/* ... */) and line comments (// ...) so
      // TODO and doc mentions of `fetch(` don't trigger the regex.
      const stripped = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
      // Match bare fetch(...) invocations. The lookbehind ensures the
      // preceding char is not an identifier character or dot, so
      // `guardedFetch(`, `fabraryService.fetchDeck(`, etc. don't match.
      const directFetch = stripped.match(/(?<![a-zA-Z0-9_.])fetch\(/g);
      expect(directFetch).toBeNull();
    });
  });
});
