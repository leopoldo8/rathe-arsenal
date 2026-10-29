import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';

/** What a visitor needs of one of the sharer's active picks: which card stands in for which, and how many copies. */
export type TActiveReplacement = Pick<
  CardReplacementEntity,
  'slot' | 'originalCardIdentifier' | 'replacementCardIdentifier' | 'quantity' | 'side'
>;

@Injectable()
export class SharedDeckReplacements {
  constructor(@InjectRepository(CardReplacementEntity) private readonly replacements: Repository<CardReplacementEntity>) {}

  /** The sharer's picks still standing, oldest first. A kept, reverted or removed pick is history and never shows. */
  async active(deckId: number): Promise<TActiveReplacement[]> {
    const rows = await this.replacements.find({
      where: { trackedDeckId: deckId, status: 'active' },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(({ slot, originalCardIdentifier, replacementCardIdentifier, quantity, side }) => ({
      slot,
      originalCardIdentifier,
      replacementCardIdentifier,
      quantity,
      side,
    }));
  }
}
