import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ShareLinkEntity, TDeckShareIntent } from '../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { isShareTokenShape } from './share-token';

export interface ILiveSharedDeck {
  readonly link: ShareLinkEntity & { readonly intent: TDeckShareIntent };
  readonly deck: TrackedDeckEntity;
  readonly owner: UserEntity;
}

const DECK_INTENTS: readonly string[] = ['deck', 'missing'];

@Injectable()
export class SharedDeckLookup {
  constructor(
    @InjectRepository(ShareLinkEntity)
    private readonly links: Repository<ShareLinkEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
  ) {}

  /**
   * The only way to resolve a deck token: callers never learn why a token is unavailable.
   * `intent` narrows the answer for routes that serve one intent only.
   */
  async findLive(token: unknown, intent?: TDeckShareIntent): Promise<ILiveSharedDeck | null> {
    if (!isShareTokenShape(token)) return null;

    const link = await this.links.findOne({ where: { token, targetKind: 'deck' } });
    if (!link || !DECK_INTENTS.includes(link.intent)) return null;
    if (intent && link.intent !== intent) return null;

    const deck = await this.trackedDecks.findOne({
      where: { id: link.targetId, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
    if (!deck) return null;

    return { link: link as ILiveSharedDeck['link'], deck, owner: deck.user };
  }
}
