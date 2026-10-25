import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';
import { IStoreOffer } from './store-offer';
import { CreditBudgetService } from './credit-budget.service';
import { readStoreAnswersConfig } from './store-answers.config';
import { classifyStoreRow, NO_LOOKUP, rowFactsOf, TStoreState } from './store-state';
import { VariantFetchQueueService } from './variant-fetch-queue.service';

export const DEFAULT_STORE_SLUG = 'cupula-dt';

@Injectable()
export class StoreAnswersService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreStockEntity)
    private readonly stockRepo: Repository<StoreStockEntity>,
    @InjectRepository(StoreStockVariantEntity)
    private readonly variantRepo: Repository<StoreStockVariantEntity>,
    private readonly queue: VariantFetchQueueService,
    private readonly budget: CreditBudgetService,
    private readonly config: ConfigService,
  ) {}

  /** Reads the stored answers and never queues a lookup: the public pages call this. */
  async read(cardIdentifiers: readonly string[], now: Date = new Date()): Promise<Map<string, TStoreState>> {
    const states = new Map<string, TStoreState>();
    const wanted = [...new Set(cardIdentifiers)];
    for (const cardIdentifier of wanted) states.set(cardIdentifier, 'not_on_site');
    if (wanted.length === 0) return states;

    const store = await this.storeRepo.findOne({ where: { slug: DEFAULT_STORE_SLUG, active: true } });
    if (!store) return states;

    const [rows, facts, status] = await Promise.all([
      this.stockRepo.find({ where: { storeId: store.id, cardIdentifier: In(wanted) } }),
      this.queue.lookupFacts(wanted),
      this.budget.status(now),
    ]);
    const { priceValidDays } = readStoreAnswersConfig(this.config);
    for (const row of rows) {
      const { state } = classifyStoreRow({
        row: rowFactsOf(row),
        lastAvailabilityPassAt: store.lastAvailabilityPassAt,
        lookup: facts.get(row.cardIdentifier) ?? NO_LOOKUP,
        priceValidDays,
        budgetStopped: status.lookupsStopped,
        now,
      });
      states.set(row.cardIdentifier, state);
    }
    return states;
  }

  /** The owner's list: queues the lookups the cards still need, then reads the answers. */
  async openForOwner(cardIdentifiers: readonly string[], now: Date = new Date()): Promise<Map<string, TStoreState>> {
    const store = await this.storeRepo.findOne({ where: { slug: DEFAULT_STORE_SLUG, active: true } });
    if (store) await this.queue.enqueueMissing(store.id, cardIdentifiers, now);
    return this.read(cardIdentifiers, now);
  }

  /** The store's own pages for the cards: product link and stocked versions. Reads only. */
  async readOffers(cardIdentifiers: readonly string[]): Promise<{
    readonly baseUrl: string | null;
    readonly lastAvailabilityPassAt: Date | null;
    readonly offers: Map<string, IStoreOffer>;
  }> {
    const offers = new Map<string, IStoreOffer>();
    const wanted = [...new Set(cardIdentifiers)];
    const store = await this.storeRepo.findOne({ where: { slug: DEFAULT_STORE_SLUG, active: true } });
    if (!store) return { baseUrl: null, lastAvailabilityPassAt: null, offers };
    if (wanted.length === 0) return { baseUrl: store.baseUrl, lastAvailabilityPassAt: store.lastAvailabilityPassAt, offers };

    const [rows, variants] = await Promise.all([
      this.stockRepo.find({ where: { storeId: store.id, cardIdentifier: In(wanted) } }),
      this.variantRepo.find({ where: { storeId: store.id, cardIdentifier: In(wanted) } }),
    ]);
    for (const row of rows) {
      const own = variants.filter((variant) => variant.cardIdentifier === row.cardIdentifier);
      const versions =
        own.length > 0
          ? own.map((variant) => ({
              priceCents: variant.priceCents,
              quantity: variant.quantity,
              edition: variant.edition,
              foil: /foil/i.test(variant.finish) && !/non-?foil/i.test(variant.finish),
            }))
          : row.priceCents === null
            ? []
            : [{ priceCents: row.priceCents, quantity: row.quantity, edition: '', foil: false }];
      offers.set(row.cardIdentifier, { productUrl: sameHostUrl(row.productUrl, store.baseUrl), versions });
    }
    return { baseUrl: store.baseUrl, lastAvailabilityPassAt: store.lastAvailabilityPassAt, offers };
  }
}

/** The product link only when it stays on the store's own host, as the shopping line checks at read time. */
function sameHostUrl(productUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(productUrl);
    return url.protocol === 'https:' && url.hostname === new URL(baseUrl).hostname ? productUrl : null;
  } catch {
    return null;
  }
}
