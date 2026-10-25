import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';

/** What one of the visitor's decks still misses of a card, judged on its own against the whole collection. */
export interface IDeckMissing {
  readonly deckId: number;
  readonly deckName: string;
  readonly missing: number;
}

@Injectable()
export class VisitorDecksMissingService {
  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly decks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
  ) {}

  /**
   * Copies missing per card across the visitor's non-retired decks, each deck judged on its own
   * against the whole collection: the same raw count the deck's missing panel starts from.
   */
  async missingByCard(
    visitorId: string,
    cardIdentifiers: ReadonlySet<string>,
    inventory: ReadonlyMap<string, number>,
  ): Promise<Map<string, number>> {
    const perDeck = await this.missingPerDeck(visitorId, cardIdentifiers, inventory);
    return new Map([...perDeck].map(([cardIdentifier, decks]) => [cardIdentifier, decks.reduce((sum, deck) => sum + deck.missing, 0)]));
  }

  /** The same gap, kept per deck, so a hint can name one deck with that deck's own count instead of the sum. */
  async missingPerDeck(
    visitorId: string,
    cardIdentifiers: ReadonlySet<string>,
    inventory: ReadonlyMap<string, number>,
  ): Promise<Map<string, IDeckMissing[]>> {
    const perDeck = new Map<string, IDeckMissing[]>();
    if (cardIdentifiers.size === 0) return perDeck;

    const decks = await this.decks.find({
      where: { userId: visitorId, status: Not('retired'), deletedAt: IsNull() },
      select: { id: true, name: true },
    });
    if (decks.length === 0) return perDeck;

    const rows = await this.deckCards.find({ where: { trackedDeckId: In(decks.map((deck) => deck.id)) } });
    const rowsByDeck = new Map<number, DeckCardEntity[]>();
    for (const row of rows) {
      rowsByDeck.set(row.trackedDeckId, [...(rowsByDeck.get(row.trackedDeckId) ?? []), row]);
    }

    for (const deck of decks) {
      const deckRows = rowsByDeck.get(deck.id);
      if (deckRows === undefined) continue;
      const { breakdown } = computeEffectiveReadiness({ cards: deckRows }, inventory, catalog);
      for (const entry of breakdown.notOwned) {
        if (!cardIdentifiers.has(entry.cardIdentifier)) continue;
        const gap = { deckId: deck.id, deckName: deck.name, missing: entry.quantity };
        perDeck.set(entry.cardIdentifier, [...(perDeck.get(entry.cardIdentifier) ?? []), gap]);
      }
    }
    return perDeck;
  }
}
