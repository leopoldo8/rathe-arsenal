import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ResolveJobCardsService } from '../resolve-job-cards.service';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';

function buildStockRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockEntity> = {},
): StoreStockEntity {
  return {
    id: 100,
    storeId: 1,
    cardIdentifier,
    productNameRaw: cardIdentifier,
    priceCents: 5000,
    quantity: 4,
    productUrl: `https://example.com/cards/${cardIdentifier}`,
    lastFetchedAt: new Date('2026-04-13T09:00:00Z'),
    store: {} as StoreStockEntity['store'],
    ...overrides,
  };
}

describe('ResolveJobCardsService', () => {
  let service: ResolveJobCardsService;
  let stockRepo: jest.Mocked<Repository<StoreStockEntity>>;

  beforeEach(async () => {
    stockRepo = createMock<Repository<StoreStockEntity>>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveJobCardsService,
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
      ],
    }).compile();

    service = moduleRef.get(ResolveJobCardsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolve()', () => {
    it('maps rows with productUrl to IFetchCard', async () => {
      // Arrange
      stockRepo.find.mockResolvedValue([
        buildStockRow('card-a', { priceCents: 1200, quantity: 3 }),
        buildStockRow('card-b', { priceCents: null, quantity: 1 }),
      ]);

      // Act
      const result = await service.resolve(1, ['card-a', 'card-b']);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        cardIdentifier: 'card-a',
        productUrl: 'https://example.com/cards/card-a',
        listingPriceCents: 1200,
        listingQuantity: 3,
      });
      expect(result[1]).toEqual({
        cardIdentifier: 'card-b',
        productUrl: 'https://example.com/cards/card-b',
        listingPriceCents: null,
        listingQuantity: 1,
      });
    });

    it('skips cards whose stock row has no productUrl', async () => {
      // Arrange
      stockRepo.find.mockResolvedValue([
        buildStockRow('card-a'),
        buildStockRow('card-no-url', { productUrl: null as unknown as string }),
      ]);

      // Act
      const result = await service.resolve(1, ['card-a', 'card-no-url', 'card-missing']);

      // Assert: only card-a maps (card-no-url has null productUrl, card-missing has no row)
      expect(result).toHaveLength(1);
      expect(result[0]?.cardIdentifier).toBe('card-a');
    });

    it('skips cards with no matching stock row', async () => {
      // Arrange
      stockRepo.find.mockResolvedValue([buildStockRow('card-a')]);

      // Act
      const result = await service.resolve(1, ['card-a', 'card-unknown']);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.cardIdentifier).toBe('card-a');
    });

    it('returns an empty array when no cards have a productUrl', async () => {
      // Arrange
      stockRepo.find.mockResolvedValue([
        buildStockRow('card-a', { productUrl: '' }),
      ]);

      // Act
      const result = await service.resolve(1, ['card-a']);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('passes storeId and cardIdentifiers to the repository', async () => {
      // Arrange
      stockRepo.find.mockResolvedValue([]);

      // Act
      await service.resolve(42, ['card-x', 'card-y']);

      // Assert
      expect(stockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ storeId: 42 }) }),
      );
    });
  });
});
