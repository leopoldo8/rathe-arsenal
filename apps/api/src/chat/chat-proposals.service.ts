import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { ChatProposalEntity, IDeckProposalPayload, ISwapProposalPayload } from '../database/entities/chat-proposal.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { RecommendationQueueService } from '../recommendations/recommendation-queue.service';
import { ReplacementsService } from '../replacements/replacements.service';
import { SubstitutionService } from '../substitution/substitution.service';
import { chatError } from './chat-errors';
import { validateDeckProposal } from './proposal-validation';

export type TApplyResponse = { readonly trackedDeckId: number } | { readonly replacementId: string };

type TApplyOutcome =
  | { readonly kind: 'applied'; readonly response: TApplyResponse; readonly createdDeckId: number | null }
  | { readonly kind: 'stale'; readonly reason: string };

@Injectable()
export class ChatProposalsService {
  private readonly logger = new Logger(ChatProposalsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly replacements: ReplacementsService,
    private readonly recommendationQueue: RecommendationQueueService,
    private readonly substitution: SubstitutionService,
  ) {}

  async apply(userId: string, proposalId: string): Promise<TApplyResponse> {
    const outcome = await this.dataSource.transaction(async (manager): Promise<TApplyOutcome & { kindOf: string }> => {
      const proposal = await this.lockPending(manager, userId, proposalId);
      const result = proposal.kind === 'deck' ? await this.applyDeck(manager, userId, proposal) : await this.applySwap(manager, userId, proposal);
      if (result.kind === 'stale') {
        await manager.update(ChatProposalEntity, { id: proposal.id }, { status: 'stale', decidedAt: new Date() });
      }
      return { ...result, kindOf: proposal.kind };
    });

    if (outcome.kind === 'stale') {
      this.logger.warn({ event: 'chat.proposal.stale', proposalId, kind: outcome.kindOf, userId, reason: outcome.reason });
      throw chatError('PROPOSAL_STALE');
    }
    if (outcome.createdDeckId !== null) {
      await this.substitution.computeAndStoreReadiness(outcome.createdDeckId, userId);
    }
    this.logger.log({ event: 'chat.proposal.applied', proposalId, kind: outcome.kindOf, userId });
    return outcome.response;
  }

  async dismiss(userId: string, proposalId: string): Promise<{ id: string; status: 'dismissed' }> {
    const kind = await this.dataSource.transaction(async (manager) => {
      const proposal = await this.lockPending(manager, userId, proposalId);
      await manager.update(ChatProposalEntity, { id: proposal.id }, { status: 'dismissed', decidedAt: new Date() });
      return proposal.kind;
    });
    this.logger.log({ event: 'chat.proposal.dismissed', proposalId, kind, userId });
    return { id: proposalId, status: 'dismissed' };
  }

  private async lockPending(manager: EntityManager, userId: string, proposalId: string): Promise<ChatProposalEntity> {
    const [row] = (await manager.query(
      `SELECT p.id FROM chat_proposal p
         JOIN chat_message m ON m.id = p."messageId"
         JOIN chat_conversation c ON c.id = m."conversationId"
        WHERE p.id = $1 AND c."userId" = $2
        FOR UPDATE OF p`,
      [proposalId, userId],
    )) as Array<{ id: string }>;
    if (!row) throw new NotFoundException('Proposal not found');
    const proposal = await manager.findOneOrFail(ChatProposalEntity, { where: { id: row.id } });
    if (proposal.status !== 'pending') throw chatError('PROPOSAL_NOT_PENDING');
    return proposal;
  }

  private async applyDeck(manager: EntityManager, userId: string, proposal: ChatProposalEntity): Promise<TApplyOutcome> {
    const payload = proposal.payload as IDeckProposalPayload;
    const check = validateDeckProposal({ ...payload, cards: [...payload.cards], reason: proposal.reason }, catalog);
    if (!check.ok) return { kind: 'stale', reason: check.error };

    const hero = catalog.getCard(check.payload.heroIdentifier);
    const deck = await manager.save(
      manager.create(TrackedDeckEntity, {
        userId,
        fabraryUlid: null,
        name: check.payload.name,
        hero: hero.name,
        heroIdentifier: hero.cardIdentifier,
        format: check.payload.format,
        status: 'idea',
      }),
    );
    if (check.payload.cards.length > 0) {
      await manager.insert(
        DeckCardEntity,
        check.payload.cards.map((card) => ({ trackedDeckId: deck.id, cardIdentifier: card.cardIdentifier, quantity: card.quantity, slot: card.slot })),
      );
    }
    await this.recommendationQueue.enqueueAuto(manager, deck.id);
    await manager.update(ChatProposalEntity, { id: proposal.id }, { status: 'applied', decidedAt: new Date(), trackedDeckId: deck.id });
    return { kind: 'applied', response: { trackedDeckId: deck.id }, createdDeckId: deck.id };
  }

  private async applySwap(manager: EntityManager, userId: string, proposal: ChatProposalEntity): Promise<TApplyOutcome> {
    if (proposal.trackedDeckId === null) return { kind: 'stale', reason: 'DECK_GONE' };
    const payload = proposal.payload as ISwapProposalPayload;
    const result = await this.replacements.applyChatSwap(manager, userId, { ...payload, trackedDeckId: proposal.trackedDeckId });
    if (result.kind === 'stale') return result;
    await manager.update(
      ChatProposalEntity,
      { id: proposal.id },
      { status: 'applied', decidedAt: new Date(), cardReplacementId: result.replacementId },
    );
    return { kind: 'applied', response: { replacementId: result.replacementId }, createdDeckId: null };
  }
}
