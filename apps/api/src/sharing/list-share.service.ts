import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ShareLinkEntity } from '../database/entities/share-link.entity';
import { UserEntity } from '../database/entities/user.entity';
import { cardListNotFound } from '../lists/lists-errors';
import { ILinkState } from './dtos/share-state.dto';
import { ShareEventsService } from './share-events.service';
import { generateShareToken } from './share-token';
import { buildListShareUrl } from './share-url';
import { displayNameRequired, shareLinkUnavailable } from './sharing-errors';

@Injectable()
export class ListShareService {
  constructor(
    @InjectRepository(CardListEntity)
    private readonly lists: Repository<CardListEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ShareLinkEntity)
    private readonly links: Repository<ShareLinkEntity>,
    private readonly events: ShareEventsService,
    private readonly config: ConfigService,
  ) {}

  async getState(userId: string, listId: number): Promise<ILinkState | null> {
    const list = await this.ownedList(userId, listId);
    const link = await this.links.findOneBy({ targetKind: 'list', targetId: list.id, ownerUserId: userId });
    return link ? this.toState(link) : null;
  }

  async enable(userId: string, listId: number): Promise<ILinkState> {
    const list = await this.ownedList(userId, listId);
    const owner = await this.users.findOneByOrFail({ id: userId });
    if (!owner.displayName) throw displayNameRequired();

    const issued = await this.issueLink(list, userId);
    if (issued) {
      await this.events.record({
        kind: 'created',
        targetKind: 'list',
        targetId: list.id,
        intent: list.kind,
        ownerUserId: userId,
        actorUserId: userId,
      });
      return this.toState(issued);
    }

    const existing = await this.links.findOneByOrFail({ targetKind: 'list', targetId: list.id, intent: list.kind });
    return this.toState(existing);
  }

  /** The stored image goes with the row (foreign key cascade). */
  async disable(userId: string, listId: number): Promise<void> {
    const list = await this.ownedList(userId, listId);
    await this.links.delete({ targetKind: 'list', targetId: list.id, ownerUserId: userId });
  }

  async setShowContact(userId: string, listId: number, showContact: boolean): Promise<ILinkState> {
    const list = await this.ownedList(userId, listId);
    const result = await this.links.update(
      { targetKind: 'list', targetId: list.id, ownerUserId: userId },
      { showsContact: showContact },
    );
    if (result.affected !== 1) throw shareLinkUnavailable();
    const link = await this.links.findOneByOrFail({ targetKind: 'list', targetId: list.id, intent: list.kind });
    return this.toState(link);
  }

  private async ownedList(userId: string, listId: number): Promise<CardListEntity> {
    const list = await this.lists.findOneBy({ id: listId, userId });
    if (!list) throw cardListNotFound();
    return list;
  }

  /**
   * ON CONFLICT DO NOTHING: only the request that inserts the row wins, so two concurrent
   * "on" calls agree on one token and only one records `created`.
   */
  private async issueLink(list: CardListEntity, userId: string): Promise<ShareLinkEntity | null> {
    const rows: ShareLinkEntity[] = await this.links.query(
      `INSERT INTO "share_link" ("token", "targetKind", "targetId", "intent", "ownerUserId")
       VALUES ($1, 'list', $2, $3, $4)
       ON CONFLICT ("targetKind", "targetId", "intent") DO NOTHING
       RETURNING "token", "intent", "showsContact"`,
      [generateShareToken(), list.id, list.kind, userId],
    );
    return rows[0] ?? null;
  }

  private toState(link: Pick<ShareLinkEntity, 'token' | 'intent' | 'showsContact'>): ILinkState {
    return {
      intent: link.intent,
      url: buildListShareUrl(this.config.get<string>('APP_BASE_URL'), link.token),
      token: link.token,
      showContact: link.showsContact,
    };
  }
}
