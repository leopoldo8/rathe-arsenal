import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ShareLinkEntity } from '../database/entities/share-link.entity';
import { UserEntity } from '../database/entities/user.entity';
import { isShareTokenShape } from './share-token';

export interface ILiveSharedList {
  readonly link: ShareLinkEntity & { readonly intent: 'want' | 'sell' };
  readonly list: CardListEntity;
  readonly owner: UserEntity;
}

const LIST_INTENTS: readonly string[] = ['want', 'sell'];

@Injectable()
export class SharedListLookup {
  constructor(
    @InjectRepository(ShareLinkEntity)
    private readonly links: Repository<ShareLinkEntity>,
    @InjectRepository(CardListEntity)
    private readonly lists: Repository<CardListEntity>,
  ) {}

  /** The only way to resolve a list token: callers never learn why a token is unavailable. */
  async findLive(token: unknown): Promise<ILiveSharedList | null> {
    if (!isShareTokenShape(token)) return null;

    const link = await this.links.findOne({ where: { token, targetKind: 'list' } });
    if (!link || !LIST_INTENTS.includes(link.intent)) return null;

    const list = await this.lists.findOne({
      where: { id: link.targetId, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
    if (!list?.user || list.kind !== link.intent) return null;

    return { link: link as ILiveSharedList['link'], list, owner: list.user };
  }
}
