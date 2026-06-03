import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { IFetchCard } from './types/fetch-card';

/**
 * Resolves a list of cardIdentifiers to IFetchCard via the store_stock table.
 * Cards without a productUrl are silently skipped — they have no detail page
 * to fetch.
 *
 * Extracted from VariantFetchController so the same logic can be reused by
 * the variant-job worker (Task 6).
 */
@Injectable()
export class ResolveJobCardsService {
  constructor(
    @InjectRepository(StoreStockEntity)
    private readonly stockRepo: Repository<StoreStockEntity>,
  ) {}

  /**
   * Map `cardIdentifiers` to `IFetchCard` via `store_stock`; skip cards with
   * no `productUrl`.
   */
  async resolve(
    storeId: number,
    cardIdentifiers: readonly string[],
  ): Promise<IFetchCard[]> {
    const rows = await this.stockRepo.find({
      where: { storeId, cardIdentifier: In([...cardIdentifiers]) },
    });

    const byId = new Map(rows.map((r) => [r.cardIdentifier, r]));

    return cardIdentifiers
      .map((id): IFetchCard | null => {
        const row = byId.get(id);
        if (!row?.productUrl) return null;
        return {
          cardIdentifier: id,
          productUrl: row.productUrl,
          listingPriceCents: row.priceCents,
          listingQuantity: row.quantity,
        };
      })
      .filter((c): c is IFetchCard => c !== null);
  }
}
