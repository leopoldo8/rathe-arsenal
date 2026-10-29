import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { SpareCopiesService } from '../collection/spare/spare-copies.service';
import { TLocale } from '../common/i18n/resolve-locale';
import { ChatConversationEntity } from '../database/entities/chat-conversation.entity';
import { ChatMessageEntity } from '../database/entities/chat-message.entity';
import { ChatProposalEntity, IDeckProposalPayload, ISwapProposalPayload } from '../database/entities/chat-proposal.entity';
import { ChatBudgetService } from './chat-budget.service';
import { chatError } from './chat-errors';
import { ChatPricesService } from './chat-prices.service';
import { startOfNextUtcMonth } from './chat-pricing';

export const TITLE_MAX_LENGTH = 80;

export interface IConversationSummary {
  readonly id: string;
  readonly title: string | null;
  readonly trackedDeckId: number | null;
  readonly updatedAt: string;
}

interface ICardLabel {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
}

export interface IDeckProposalDisplay {
  readonly heroName: string;
  readonly cards: readonly (ICardLabel & { readonly quantity: number; readonly slot: string; readonly ownedQuantity: number })[];
}

/** The catalog facts the card's comparison is written from. */
export interface ISwapCardFacts {
  readonly types: readonly string[];
  readonly subtypes: readonly string[];
  readonly cost: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly pitch: number | null;
}

type TSwapCardLabel = ICardLabel & { readonly imageUrl: ICatalogCard['imageUrl']; readonly facts: ISwapCardFacts | null };

export interface ISwapProposalDisplay {
  /** `copiesLeft`: the deck copies that stay once the swap is done, whether or not it already is. */
  readonly original: TSwapCardLabel & { readonly copiesInDeck: number; readonly copiesLeft: number };
  /** `storePriceCents`: one copy at Cúpula DT, null when the store has none in stock or no price. */
  readonly replacement: TSwapCardLabel & { readonly freeCopies: number; readonly storePriceCents: number | null };
}

export interface IProposalView {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly reason: string;
  readonly payload: IDeckProposalPayload | ISwapProposalPayload;
  readonly ownedCount: number;
  readonly missingCount: number;
  readonly trackedDeckId: number | null;
  readonly display: IDeckProposalDisplay | ISwapProposalDisplay;
  readonly cardReplacementId: string | null;
  readonly replacementStatus: string | null;
}

export interface IMessageView {
  readonly id: string;
  readonly role: string;
  readonly status: string;
  readonly text: string | null;
  readonly error: string | null;
  readonly proposals: readonly IProposalView[];
  readonly createdAt: string;
}

export interface IConversationView extends IConversationSummary {
  readonly messages: readonly IMessageView[];
}

function cardLabel(cardIdentifier: string): ICardLabel {
  try {
    const card = catalog.getCard(cardIdentifier);
    return { cardIdentifier, name: card.name, pitch: card.pitch ?? null };
  } catch {
    return { cardIdentifier, name: cardIdentifier, pitch: null };
  }
}

function swapCardLabel(cardIdentifier: string): TSwapCardLabel {
  const label = cardLabel(cardIdentifier);
  try {
    const card = catalog.getCard(cardIdentifier);
    const facts: ISwapCardFacts = {
      types: card.types.map(String),
      subtypes: card.subtypes.map(String),
      cost: card.cost ?? null,
      power: card.power ?? null,
      defense: card.defense ?? null,
      pitch: card.pitch ?? null,
    };
    return { ...label, imageUrl: card.imageUrl, facts };
  } catch {
    return { ...label, imageUrl: null, facts: null };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === '23505' || (error as { driverError?: { code?: string } }).driverError?.code === '23505';
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly budget: ChatBudgetService,
    private readonly collection: CollectionReadService,
    private readonly spare: SpareCopiesService,
    private readonly prices: ChatPricesService,
  ) {}

  async list(userId: string): Promise<IConversationSummary[]> {
    const rows = await this.dataSource.getRepository(ChatConversationEntity).find({
      where: { userId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => this.summary(row));
  }

  async create(userId: string, trackedDeckId: number | undefined): Promise<{ id: string }> {
    if (trackedDeckId !== undefined) {
      const [deck] = (await this.dataSource.query(`SELECT id FROM tracked_deck WHERE id = $1 AND "userId" = $2 AND "deletedAt" IS NULL`, [trackedDeckId, userId])) as unknown[];
      if (!deck) throw new NotFoundException('Tracked deck not found');
    }
    const saved = await this.dataSource
      .getRepository(ChatConversationEntity)
      .save({ userId, trackedDeckId: trackedDeckId ?? null, title: null });
    return { id: saved.id };
  }

  async read(userId: string, conversationId: string): Promise<IConversationView> {
    const conversation = await this.owned(userId, conversationId);
    const messages = (await this.dataSource.query(
      `SELECT id, role, status, text, error, "createdAt" FROM chat_message WHERE "conversationId" = $1
        ORDER BY "createdAt", CASE role WHEN 'user' THEN 0 ELSE 1 END, id`,
      [conversationId],
    )) as Array<{ id: string; role: string; status: string; text: string | null; error: string | null; createdAt: Date }>;
    const proposals = await this.dataSource
      .getRepository(ChatProposalEntity)
      .createQueryBuilder('proposal')
      .where('proposal.messageId IN (:...ids)', { ids: messages.length > 0 ? messages.map((message) => message.id) : ['00000000-0000-0000-0000-000000000000'] })
      .orderBy('proposal.createdAt')
      .addOrderBy('proposal.id')
      .getMany();
    const views = await this.proposalViews(userId, proposals);
    return {
      ...this.summary(conversation),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        status: message.status,
        text: message.text,
        error: message.error,
        proposals: views.filter((view) => view.messageId === message.id).map(({ messageId: _messageId, ...view }) => view),
        createdAt: new Date(message.createdAt).toISOString(),
      })),
    };
  }

  async send(userId: string, conversationId: string, text: string, locale: TLocale): Promise<{ userMessageId: string; assistantMessageId: string }> {
    const conversation = await this.owned(userId, conversationId);
    await this.assertCanStartTurn(userId, conversationId);
    try {
      const ids = await this.dataSource.transaction(async (manager) => {
        const sentAt = new Date();
        const user = await manager.save(ChatMessageEntity, {
          conversationId,
          role: 'user' as const,
          status: 'done' as const,
          text,
          locale,
          createdAt: sentAt,
        });
        const assistant = await manager.save(ChatMessageEntity, {
          conversationId,
          role: 'assistant' as const,
          status: 'pending' as const,
          text: null,
          locale,
          createdAt: new Date(sentAt.getTime() + 1),
        });
        await this.touch(manager, conversationId, conversation.title === null ? text.slice(0, TITLE_MAX_LENGTH) : null);
        return { userMessageId: user.id, assistantMessageId: assistant.id };
      });
      this.logger.log({ event: 'chat.message.sent', userId, conversationId, ...ids });
      return ids;
    } catch (error) {
      if (isUniqueViolation(error)) throw chatError('CHAT_TURN_IN_PROGRESS');
      throw error;
    }
  }

  async retry(userId: string, conversationId: string, messageId: string): Promise<{ assistantMessageId: string }> {
    await this.owned(userId, conversationId);
    const message = await this.dataSource.getRepository(ChatMessageEntity).findOne({ where: { id: messageId, conversationId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.role !== 'assistant' || message.status !== 'failed') throw chatError('MESSAGE_NOT_RETRYABLE');
    await this.assertCanStartTurn(userId, conversationId);
    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        const result = await manager.update(
          ChatMessageEntity,
          { id: messageId, status: 'failed' },
          { status: 'pending', error: null, claimedAt: null, startedAt: null, finishedAt: null, attempts: 0 },
        );
        await this.touch(manager, conversationId, null);
        return result.affected ?? 0;
      });
      if (updated === 0) throw chatError('MESSAGE_NOT_RETRYABLE');
    } catch (error) {
      if (isUniqueViolation(error)) throw chatError('CHAT_TURN_IN_PROGRESS');
      throw error;
    }
    return { assistantMessageId: messageId };
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    await this.owned(userId, conversationId);
    await this.dataSource.getRepository(ChatConversationEntity).delete({ id: conversationId, userId });
  }

  private async assertCanStartTurn(userId: string, conversationId: string): Promise<void> {
    const open = await this.dataSource.query(
      `SELECT 1 FROM chat_message WHERE "conversationId" = $1 AND status IN ('pending', 'running') LIMIT 1`,
      [conversationId],
    );
    if ((open as unknown[]).length > 0) throw chatError('CHAT_TURN_IN_PROGRESS');
    const now = new Date();
    if (await this.budget.isExhausted(userId, now)) {
      throw chatError('CHAT_BUDGET_EXHAUSTED', { resetsAt: startOfNextUtcMonth(now).toISOString() });
    }
  }

  private async touch(manager: EntityManager, conversationId: string, title: string | null): Promise<void> {
    await manager.query(
      `UPDATE chat_conversation SET "updatedAt" = clock_timestamp(), title = COALESCE(title, $2) WHERE id = $1`,
      [conversationId, title],
    );
  }

  private async owned(userId: string, conversationId: string): Promise<ChatConversationEntity> {
    const conversation = await this.dataSource.getRepository(ChatConversationEntity).findOne({ where: { id: conversationId, userId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private summary(row: ChatConversationEntity): IConversationSummary {
    return { id: row.id, title: row.title, trackedDeckId: row.trackedDeckId, updatedAt: new Date(row.updatedAt).toISOString() };
  }

  private async proposalViews(userId: string, proposals: readonly ChatProposalEntity[]): Promise<Array<IProposalView & { messageId: string }>> {
    if (proposals.length === 0) return [];
    const cardIds = proposals.flatMap((proposal) =>
      proposal.kind === 'deck'
        ? (proposal.payload as IDeckProposalPayload).cards.map((card) => card.cardIdentifier)
        : [(proposal.payload as ISwapProposalPayload).replacementCardIdentifier],
    );
    const owned = await this.collection.loadOwned(userId, cardIds);
    const swapReplacements = proposals.filter((p) => p.kind === 'swap').map((p) => (p.payload as ISwapProposalPayload).replacementCardIdentifier);
    const [spareByCard, storePrices] =
      swapReplacements.length === 0
        ? [null, new Map<string, number>()]
        : await Promise.all([this.spare.spareByCard(userId), this.prices.storeUnitPrices(swapReplacements)]);
    const swapDecks = [...new Set(proposals.filter((p) => p.kind === 'swap' && p.trackedDeckId !== null).map((p) => p.trackedDeckId!))];
    const inDeck = new Map<string, number>();
    if (swapDecks.length > 0) {
      const rows = (await this.dataSource.query(
        `SELECT "trackedDeckId", "cardIdentifier", SUM(quantity)::int AS quantity FROM deck_card WHERE "trackedDeckId" = ANY($1) GROUP BY 1, 2`,
        [swapDecks],
      )) as Array<{ trackedDeckId: number; cardIdentifier: string; quantity: number }>;
      for (const row of rows) inDeck.set(`${row.trackedDeckId}|${row.cardIdentifier}`, row.quantity);
    }
    const replacementIds = proposals.flatMap((proposal) => (proposal.cardReplacementId === null ? [] : [proposal.cardReplacementId]));
    const replacementStatuses = new Map<string, string>();
    if (replacementIds.length > 0) {
      const rows = (await this.dataSource.query(`SELECT id, status FROM card_replacement WHERE id = ANY($1)`, [replacementIds])) as Array<{ id: string; status: string }>;
      for (const row of rows) replacementStatuses.set(row.id, row.status);
    }
    return proposals.map((proposal) => {
      let ownedCount = 0;
      let missingCount = 0;
      let display: IDeckProposalDisplay | ISwapProposalDisplay;
      if (proposal.kind === 'deck') {
        const payload = proposal.payload as IDeckProposalPayload;
        const cards = payload.cards.map((card) => {
          const ownedQuantity = Math.min(card.quantity, owned.get(card.cardIdentifier) ?? 0);
          ownedCount += ownedQuantity;
          missingCount += card.quantity - ownedQuantity;
          return { ...cardLabel(card.cardIdentifier), quantity: card.quantity, slot: card.slot, ownedQuantity };
        });
        display = { heroName: cardLabel(payload.heroIdentifier).name, cards };
      } else {
        const payload = proposal.payload as ISwapProposalPayload;
        const replacement = payload.replacementCardIdentifier;
        const free = Math.max(spareByCard?.spare.get(replacement) ?? 0, 0);
        ownedCount = free > 0 ? 1 : 0;
        missingCount = free > 0 ? 0 : 1;
        const copiesInDeck = inDeck.get(`${proposal.trackedDeckId}|${payload.originalCardIdentifier}`) ?? 0;
        // A pending deck-side swap has not taken its copies off the deck yet; every other swap leaves the deck copies as they are.
        const leaving = proposal.status === 'pending' && payload.side === 'deck' ? (payload.quantity ?? 0) : 0;
        display = {
          original: { ...swapCardLabel(payload.originalCardIdentifier), copiesInDeck, copiesLeft: Math.max(copiesInDeck - leaving, 0) },
          replacement: { ...swapCardLabel(replacement), freeCopies: free, storePriceCents: storePrices.get(replacement) ?? null },
        };
      }
      return {
        messageId: proposal.messageId,
        id: proposal.id,
        kind: proposal.kind,
        status: proposal.status,
        reason: proposal.reason,
        payload: proposal.payload,
        ownedCount,
        missingCount,
        trackedDeckId: proposal.trackedDeckId,
        display,
        cardReplacementId: proposal.cardReplacementId,
        replacementStatus: proposal.cardReplacementId === null ? null : (replacementStatuses.get(proposal.cardReplacementId) ?? null),
      };
    });
  }
}
