import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TListKind } from '../database/entities/card-list.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SharedDeckMissingService } from '../sharing/shared-deck-missing.service';
import { deckNotFound } from './lists-errors';
import { groupByCard, IQuantityEntry } from './line-math';

const MAX_DECK_ID = 2_147_483_647;

@Injectable()
export class ListFromDeckService {
  constructor(
    @InjectRepository(TrackedDeckEntity) private readonly decks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity) private readonly deckCards: Repository<DeckCardEntity>,
    private readonly missing: SharedDeckMissingService,
  ) {}

  /**
   * A want list takes what the deck's `missing` share link shows; a sell list takes every card row of the deck.
   * A scratch deck's hero has no card row, so it is not on a sell list.
   */
  async linesFor(userId: string, kind: TListKind, deckId: number): Promise<IQuantityEntry[]> {
    if (deckId > MAX_DECK_ID) throw deckNotFound();
    const deck = await this.decks.findOne({ where: { id: deckId, userId, deletedAt: IsNull() }, select: ['id'] });
    if (!deck) throw deckNotFound();

    const rows = await this.deckCards.find({ where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
    if (kind === 'sell') return groupByCard(rows);
    return groupByCard(await this.missing.missingFor(userId, rows));
  }
}
