import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { isShareTokenShape } from './share-token';

export interface ILiveSharedDeck {
  readonly deck: TrackedDeckEntity;
  readonly owner: UserEntity;
}

@Injectable()
export class SharedDeckLookup {
  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
  ) {}

  /** The only way to resolve a deck token: callers never learn why a token is unavailable. */
  async findLive(token: unknown): Promise<ILiveSharedDeck | null> {
    if (!isShareTokenShape(token)) return null;

    const deck = await this.trackedDecks.findOne({
      where: { shareToken: token, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
    if (!deck) return null;

    return { deck, owner: deck.user };
  }
}
