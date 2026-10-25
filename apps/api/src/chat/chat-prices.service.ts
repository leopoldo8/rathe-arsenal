import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ICatalogCard } from '@rathe-arsenal/engine';
import { IBreakdown, IBreakdownEntry } from '../decks/dtos/tracked-deck-detail.response.dto';
import { PriceSuggestionService } from '../prices/price-suggestion.service';
import { ShoppingLineService } from '../stores/shopping-line.service';
import { InvalidToolArguments, readInteger, readList, TToolResult } from './chat-tools';
import { findCard } from './deck-rows';
import { priceReport } from './price-report';
import { slotOf } from './proposal-validation';

export const PRICE_CARDS_MAX = 20;
const PRICE_NOTE =
  'Store prices are in reais (BRL) from the store named, as last fetched on store.fetchedAt; a card with store null is out of stock or unpriced there. TCGplayer prices are in US dollars, the cheapest regular printing, as fetched on its fetchedAt; approximate means a mid price, not a market price. Quote the source and date with every price; never convert currencies or estimate a price that is not here.';

function breakdownEntry(card: ICatalogCard, quantity: number): IBreakdownEntry {
  return {
    cardIdentifier: card.cardIdentifier,
    name: card.name,
    quantity,
    slot: slotOf(card),
    pitch: card.pitch as IBreakdownEntry['pitch'],
    cost: card.cost,
    type: String(card.types[0] ?? 'unknown'),
    imageUrl: card.imageUrl,
  };
}

@Injectable()
export class ChatPricesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shoppingLine: ShoppingLineService,
    private readonly marketPrices: PriceSuggestionService,
  ) {}

  async prices(userId: string, args: Record<string, unknown>): Promise<TToolResult> {
    const deckId = readInteger(args, 'deckId', { min: 1, optional: true });
    const listed = args['cardIdentifiers'] === undefined ? undefined : readList(args, 'cardIdentifiers', PRICE_CARDS_MAX);
    if ((deckId === undefined) === (listed === undefined)) throw new InvalidToolArguments('give either cardIdentifiers or deckId');
    if (listed !== undefined) {
      const cards = listed.map((value) => (typeof value === 'string' ? findCard(value) : null));
      if (cards.some((card) => card === null)) throw new InvalidToolArguments('cardIdentifiers must be catalog card identifiers');
      const entries = cards.map((card) => breakdownEntry(card!, 1));
      return this.priceEntries(entries, { exact: [], substituted: [], missing: entries, notOwned: entries });
    }
    const [deck] = (await this.dataSource.query(`SELECT id FROM tracked_deck WHERE id = $1 AND "userId" = $2 AND "deletedAt" IS NULL`, [deckId, userId])) as unknown[];
    if (!deck) return { error: 'DECK_NOT_FOUND' };
    const [snapshot] = (await this.dataSource.query(
      `SELECT breakdown FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1 ORDER BY "computedAt" DESC, id DESC LIMIT 1`,
      [deckId],
    )) as Array<{ breakdown: IBreakdown }>;
    if (!snapshot) return { error: 'READINESS_NOT_COMPUTED' };
    if (snapshot.breakdown.missing.length === 0) return { nothingMissing: true, note: 'The user owns every card this deck needs; there is nothing to buy.' };
    return this.priceEntries(snapshot.breakdown.missing, snapshot.breakdown);
  }

  private async priceEntries(entries: readonly IBreakdownEntry[], breakdown: IBreakdown): Promise<TToolResult> {
    const quantities = new Map<string, number>();
    for (const entry of entries) quantities.set(entry.cardIdentifier, (quantities.get(entry.cardIdentifier) ?? 0) + entry.quantity);
    const wanted = [...quantities].map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity }));
    const [store, market] = await Promise.all([
      this.shoppingLine.computeForBreakdown(breakdown),
      this.marketPrices.marketPrices(wanted.map((card) => card.cardIdentifier)),
    ]);
    return { note: PRICE_NOTE, ...priceReport({ wanted, store, market }) };
  }
}
