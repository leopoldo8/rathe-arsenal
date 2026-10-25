import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';

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
    const totals = new Map<string, number>();
    if (cardIdentifiers.size === 0) return totals;

    const decks = await this.decks.find({
      where: { userId: visitorId, status: Not('retired'), deletedAt: IsNull() },
      select: { id: true },
    });
    if (decks.length === 0) return totals;

    const rows = await this.deckCards.find({ where: { trackedDeckId: In(decks.map((deck) => deck.id)) } });
    const rowsByDeck = new Map<number, DeckCardEntity[]>();
    for (const row of rows) {
      rowsByDeck.set(row.trackedDeckId, [...(rowsByDeck.get(row.trackedDeckId) ?? []), row]);
    }

    for (const deckRows of rowsByDeck.values()) {
      const { breakdown } = computeEffectiveReadiness({ cards: deckRows }, inventory, catalog);
      for (const entry of breakdown.notOwned) {
        if (!cardIdentifiers.has(entry.cardIdentifier)) continue;
        totals.set(entry.cardIdentifier, (totals.get(entry.cardIdentifier) ?? 0) + entry.quantity);
      }
    }
    return totals;
  }
}
