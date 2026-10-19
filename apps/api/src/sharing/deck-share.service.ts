import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ICreatedShare, IShareState } from './dtos/share-state.dto';
import { ShareEventsService } from './share-events.service';
import { buildDeckShareUrl } from './share-url';
import { displayNameRequired } from './sharing-errors';
import { generateShareToken } from './share-token';

@Injectable()
export class DeckShareService {
  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly decks: Repository<TrackedDeckEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly events: ShareEventsService,
    private readonly config: ConfigService,
  ) {}

  async getState(userId: string, deckId: number): Promise<IShareState> {
    const deck = await this.decks.findOneByOrFail({ id: deckId, userId });
    return this.toState(deck.shareToken, deck.shareShowsContact);
  }

  async enable(userId: string, deckId: number): Promise<ICreatedShare> {
    const owner = await this.users.findOneByOrFail({ id: userId });
    if (!owner.displayName) throw displayNameRequired();

    const issued = await this.issueToken(deckId, userId);
    if (issued) {
      await this.events.record({
        kind: 'created',
        targetKind: 'deck',
        targetId: deckId,
        ownerUserId: userId,
        actorUserId: userId,
      });
      return this.toCreated(issued);
    }

    const deck = await this.decks.findOneByOrFail({ id: deckId, userId });
    return this.toCreated(deck.shareToken as string);
  }

  async disable(userId: string, deckId: number): Promise<void> {
    await this.decks
      .createQueryBuilder()
      .update()
      .set({ shareToken: null, updatedAt: () => '"updatedAt"' })
      .where({ id: deckId, userId })
      .execute();
  }

  async setShowContact(userId: string, deckId: number, showContact: boolean): Promise<IShareState> {
    await this.decks
      .createQueryBuilder()
      .update()
      .set({ shareShowsContact: showContact, updatedAt: () => '"updatedAt"' })
      .where({ id: deckId, userId })
      .execute();
    return this.getState(userId, deckId);
  }

  /**
   * Only the request that flips the column from NULL wins, so two concurrent
   * "on" calls agree on one token and only one records `created`.
   * `updatedAt` is kept as is: sharing is not an edit of the deck.
   */
  private async issueToken(deckId: number, userId: string): Promise<string | null> {
    const token = generateShareToken();
    const result = await this.decks
      .createQueryBuilder()
      .update()
      .set({ shareToken: token, updatedAt: () => '"updatedAt"' })
      .where('id = :deckId AND "userId" = :userId AND "shareToken" IS NULL', { deckId, userId })
      .execute();
    return result.affected === 1 ? token : null;
  }

  private toState(token: string | null, showContact: boolean): IShareState {
    return {
      url: token ? buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), token) : null,
      token,
      showContact,
    };
  }

  private toCreated(token: string): ICreatedShare {
    return { url: buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), token), token };
  }
}
