import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { StoreStockVariantEntity } from '../../database/entities/store-stock-variant.entity';
import { VariantFetchService } from '../variant-fetch.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_ID = 1;
const DECK_ID = 'deck-uuid-abc123';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Builds a mock SelectQueryBuilder that returns { cnt: countStr } from getRawOne. */
function buildQbMockForCount(countStr: string): jest.Mocked<SelectQueryBuilder<StoreStockVariantEntity>> {
  const getRawOneMock = jest.fn().mockResolvedValue({ cnt: countStr });
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: getRawOneMock,
  } as unknown as jest.Mocked<SelectQueryBuilder<StoreStockVariantEntity>>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('VariantFetchService', () => {
  let service: VariantFetchService;
  let variantRepo: jest.Mocked<Repository<StoreStockVariantEntity>>;

  beforeEach(async () => {
    variantRepo = createMock<Repository<StoreStockVariantEntity>>();

    // Default: returns 0 fresh cards (not fresh)
    variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('0'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantFetchService,
        { provide: getRepositoryToken(StoreStockVariantEntity), useValue: variantRepo },
      ],
    }).compile();

    service = module.get(VariantFetchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // isFreshForDeck
  // ---------------------------------------------------------------------------

  describe('isFreshForDeck', () => {
    it('returns fresh=true and inProgress=false when card list is empty', async () => {
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, []);
      expect(result.fresh).toBe(true);
      expect(result.inProgress).toBe(false);
    });

    it('returns fresh=false when no cards have fresh variant data (cnt=0)', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('0'));
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-a', 'card-b']);
      expect(result.fresh).toBe(false);
    });

    it('returns fresh=true when all cards have fresh variant data (cnt >= requested count)', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('2'));
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-a', 'card-b']);
      expect(result.fresh).toBe(true);
    });

    it('returns fresh=false when only some cards have fresh data (cnt < requested count)', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('1'));
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-a', 'card-b']);
      expect(result.fresh).toBe(false);
    });

    it('always returns inProgress=false (activeFetchSet removed in Task 12A)', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('1'));
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-a']);
      expect(result.inProgress).toBe(false);
    });

    it('queries the DB with the correct storeId and cardIdentifiers', async () => {
      const qbMock = buildQbMockForCount('1');
      variantRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-x']);

      expect(variantRepo.createQueryBuilder).toHaveBeenCalledWith('v');
      expect(qbMock.where).toHaveBeenCalledWith('v.storeId = :storeId', { storeId: STORE_ID });
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'v.cardIdentifier IN (:...cardIdentifiers)',
        { cardIdentifiers: ['card-x'] },
      );
    });

    it('handles getRawOne returning undefined gracefully (treats as cnt=0)', async () => {
      const getRawOneMock = jest.fn().mockResolvedValue(undefined);
      variantRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: getRawOneMock,
      } as unknown as jest.Mocked<SelectQueryBuilder<StoreStockVariantEntity>>);

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-a']);
      expect(result.fresh).toBe(false);
    });
  });
});
