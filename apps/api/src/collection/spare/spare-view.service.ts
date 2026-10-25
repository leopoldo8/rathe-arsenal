import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildVersionOptions } from '../../catalog/card-version-options';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { lookupCardInfo } from '../../lists/card-lookup';
import { PriceSuggestionService, versionPriceKey } from '../../prices/price-suggestion.service';
import { IIdeaDeckView, ISpareResponse, ISpareRowView, ISpareWhyView } from './dtos/spare-response.dto';
import { ISpareVersionRow } from './spare-copies';
import { ISpareSnapshot, SpareCopiesService } from './spare-copies.service';

/** The multiplier a sell list starts with: TCGplayer in dollars times 7 (`.design/sell-and-trade.md`, decision 6). */
export const SPARE_PRICE_MULTIPLIER = 7;

function isFoil(finish: string): boolean {
  return finish !== 'none';
}

function foilFinishesOf(row: ISpareVersionRow): string[] {
  const printings = buildVersionOptions(row.cardIdentifier)?.printings ?? [];
  const considered = row.printingCode === '' ? printings : printings.filter((printing) => printing.printingCode === row.printingCode);
  return [...new Set(considered.flatMap((printing) => printing.finishes.filter(isFoil)))];
}

function setNameOf(row: ISpareVersionRow): string | null {
  if (row.printingCode === '') return null;
  return buildVersionOptions(row.cardIdentifier)?.printings.find((printing) => printing.printingCode === row.printingCode)?.setName ?? null;
}

@Injectable()
export class SpareViewService {
  constructor(
    private readonly spare: SpareCopiesService,
    private readonly prices: PriceSuggestionService,
    @InjectRepository(StoreStockEntity) private readonly storeStock: Repository<StoreStockEntity>,
  ) {}

  async read(userId: string): Promise<ISpareResponse> {
    const snapshot = await this.spare.snapshot(userId);
    const base = { needsRule: snapshot.needsRule, rule: snapshot.storedRule, counts: snapshot.counts };
    if (snapshot.needsRule) return { ...base, totalSpare: 0, rows: [], why: {}, ideaDecks: [] };

    const { cards, rows } = snapshot.result;
    const cardIds = [...new Set(rows.map((row) => row.cardIdentifier))];
    const [suggestions, storePrices] = await Promise.all([
      this.prices.forVersions(rows, SPARE_PRICE_MULTIPLIER),
      this.loadStorePrices(cardIds),
    ]);

    const rowViews = rows.map((row): ISpareRowView => {
      const info = lookupCardInfo(row.cardIdentifier);
      const suggestion = suggestions.get(versionPriceKey(row));
      return {
        ...row,
        name: info.name,
        pitch: info.pitch,
        imageUrl: info.imageUrl?.small ?? null,
        setName: setNameOf(row),
        foilFinishes: foilFinishesOf(row),
        suggestedCents: suggestion?.cents ?? null,
        storeCents: storePrices.get(row.cardIdentifier) ?? null,
      };
    });
    const why: Record<string, ISpareWhyView> = {};
    for (const cardIdentifier of cardIds) {
      const card = cards.get(cardIdentifier);
      if (card) why[cardIdentifier] = { owned: card.owned, held: card.held, spare: card.spare, holders: card.holders, notHolding: card.notHolding };
    }
    return {
      ...base,
      totalSpare: [...cards.values()].reduce((sum, card) => sum + card.spare, 0),
      rows: rowViews,
      why,
      ideaDecks: this.ideaDecks(snapshot),
    };
  }

  /** Each Ideia deck that uses a card the player owns spare, with the card it uses most. */
  private ideaDecks(snapshot: ISpareSnapshot): IIdeaDeckView[] {
    const views: IIdeaDeckView[] = [];
    for (const deck of snapshot.decks.filter((entry) => entry.status === 'idea')) {
      const candidates = deck.lines
        .filter((line) => (snapshot.result.cards.get(line.cardIdentifier)?.spare ?? 0) > 0)
        .map((line) => ({ line, use: line.quantity + line.inventoryQuantity }))
        .sort((a, b) => b.use - a.use || a.line.cardIdentifier.localeCompare(b.line.cardIdentifier));
      const top = candidates[0];
      if (!top) continue;
      const info = lookupCardInfo(top.line.cardIdentifier);
      views.push({ deckId: deck.id, deckName: deck.name, cardIdentifier: top.line.cardIdentifier, name: info.name, pitch: info.pitch, use: top.use });
    }
    return views;
  }

  private async loadStorePrices(cardIdentifiers: readonly string[]): Promise<Map<string, number>> {
    if (cardIdentifiers.length === 0) return new Map();
    const rows = await this.storeStock
      .createQueryBuilder('ss')
      .select('ss.cardIdentifier', 'cardIdentifier')
      .addSelect('MIN(ss.priceCents)', 'minPriceCents')
      .where('ss.cardIdentifier IN (:...cardIdentifiers)', { cardIdentifiers })
      .andWhere('ss.quantity > 0')
      .andWhere('ss.priceCents IS NOT NULL')
      .groupBy('ss.cardIdentifier')
      .getRawMany<{ cardIdentifier: string; minPriceCents: string | null }>();
    return new Map(rows.flatMap((row) => (row.minPriceCents === null ? [] : [[row.cardIdentifier, parseInt(row.minPriceCents, 10)] as const])));
  }
}
