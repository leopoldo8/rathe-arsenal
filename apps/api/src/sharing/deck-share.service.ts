import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShareLinkEntity, TDeckShareIntent } from '../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { IDeckShareState, ILinkState } from './dtos/share-state.dto';
import { ShareEventsService } from './share-events.service';
import { buildDeckShareUrl } from './share-url';
import { displayNameRequired, shareLinkUnavailable } from './sharing-errors';
import { generateShareToken } from './share-token';

@Injectable()
export class DeckShareService {
  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly decks: Repository<TrackedDeckEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ShareLinkEntity)
    private readonly links: Repository<ShareLinkEntity>,
    private readonly events: ShareEventsService,
    private readonly config: ConfigService,
  ) {}

  async getState(userId: string, deckId: number): Promise<IDeckShareState> {
    await this.decks.findOneByOrFail({ id: deckId, userId });
    const rows = await this.links.find({ where: { targetKind: 'deck', targetId: deckId, ownerUserId: userId } });
    const stateOf = (intent: TDeckShareIntent): ILinkState | null => {
      const row = rows.find((link) => link.intent === intent);
      return row ? this.toState(intent, row) : null;
    };
    return { deck: stateOf('deck'), missing: stateOf('missing') };
  }

  async enable(userId: string, deckId: number, intent: TDeckShareIntent): Promise<ILinkState> {
    const owner = await this.users.findOneByOrFail({ id: userId });
    if (!owner.displayName) throw displayNameRequired();
    await this.decks.findOneByOrFail({ id: deckId, userId });

    const issued = await this.issueLink(deckId, userId, intent);
    if (issued) {
      await this.events.record({
        kind: 'created',
        targetKind: 'deck',
        targetId: deckId,
        intent,
        ownerUserId: userId,
        actorUserId: userId,
      });
      return this.toState(intent, issued);
    }

    const existing = await this.links.findOneByOrFail({ targetKind: 'deck', targetId: deckId, intent });
    return this.toState(intent, existing);
  }

  /** The stored image goes with the row (foreign key cascade). */
  async disable(userId: string, deckId: number, intent: TDeckShareIntent): Promise<void> {
    await this.links.delete({ targetKind: 'deck', targetId: deckId, ownerUserId: userId, intent });
  }

  async setShowContact(
    userId: string,
    deckId: number,
    intent: TDeckShareIntent,
    showContact: boolean,
  ): Promise<ILinkState> {
    const result = await this.links.update(
      { targetKind: 'deck', targetId: deckId, ownerUserId: userId, intent },
      { showsContact: showContact },
    );
    if (result.affected !== 1) throw shareLinkUnavailable();
    const link = await this.links.findOneByOrFail({ targetKind: 'deck', targetId: deckId, intent });
    return this.toState(intent, link);
  }

  /**
   * ON CONFLICT DO NOTHING: only the request that inserts the row wins, so two concurrent
   * "on" calls agree on one token and only one records `created`.
   */
  private async issueLink(
    deckId: number,
    userId: string,
    intent: TDeckShareIntent,
  ): Promise<ShareLinkEntity | null> {
    const rows: ShareLinkEntity[] = await this.links.query(
      `INSERT INTO "share_link" ("token", "targetKind", "targetId", "intent", "ownerUserId")
       VALUES ($1, 'deck', $2, $3, $4)
       ON CONFLICT ("targetKind", "targetId", "intent") DO NOTHING
       RETURNING "token", "showsContact"`,
      [generateShareToken(), deckId, intent, userId],
    );
    return rows[0] ?? null;
  }

  private toState(intent: TDeckShareIntent, link: Pick<ShareLinkEntity, 'token' | 'showsContact'>): ILinkState {
    return {
      intent,
      url: buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), link.token),
      token: link.token,
      showContact: link.showsContact,
    };
  }
}
