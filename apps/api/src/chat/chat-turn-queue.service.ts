import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatMessageEntity, TChatTurnFailureCode } from '../database/entities/chat-message.entity';
import { ChatProposalEntity, IDeckProposalPayload, ISwapProposalPayload } from '../database/entities/chat-proposal.entity';
import { ChatUsageEntity } from '../database/entities/chat-usage.entity';
import { IGeminiContent } from './gemini-chat-client';

export const CHAT_ORPHAN_MS = 10 * 60 * 1000;
export const CHAT_MAX_ATTEMPTS = 3;

export interface IClaimedTurn {
  readonly id: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly trackedDeckId: number | null;
  readonly locale: string;
  readonly attempts: number;
}

export interface IAcceptedProposal {
  readonly kind: 'deck' | 'swap';
  readonly payload: IDeckProposalPayload | ISwapProposalPayload;
  readonly reason: string;
  readonly trackedDeckId: number | null;
}

export interface ITurnDone {
  readonly text: string;
  readonly contents: readonly IGeminiContent[];
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly proposals: readonly IAcceptedProposal[];
}

function firstRow<T>(result: unknown): T | null {
  // `query()` answers an UPDATE ... RETURNING with `[rows, rowCount]`.
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
  return rows?.[0] ?? null;
}

@Injectable()
export class ChatTurnQueueService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async claimNext(): Promise<IClaimedTurn | null> {
    const claimed = firstRow<{ id: string }>(
      await this.dataSource.query(
        `UPDATE chat_message
            SET "status" = 'running', "claimedAt" = clock_timestamp(),
                "startedAt" = COALESCE("startedAt", clock_timestamp()), "attempts" = "attempts" + 1
          WHERE id = (
            SELECT m.id FROM chat_message m
             WHERE m."status" = 'pending' AND m."role" = 'assistant'
             ORDER BY m."createdAt", m.id
             FOR UPDATE SKIP LOCKED
             LIMIT 1
          )
          RETURNING id`,
      ),
    );
    if (!claimed) return null;
    const [turn] = (await this.dataSource.query(
      `SELECT m.id, m."conversationId", c."userId", c."trackedDeckId", m.locale, m.attempts
         FROM chat_message m JOIN chat_conversation c ON c.id = m."conversationId" WHERE m.id = $1`,
      [claimed.id],
    )) as IClaimedTurn[];
    return turn ?? null;
  }

  async reclaimOrphans(): Promise<void> {
    const orphaned = `"status" = 'running' AND "claimedAt" < clock_timestamp() - ($1 || ' milliseconds')::interval`;
    await this.dataSource.query(
      `UPDATE chat_message SET "status" = 'failed', "error" = 'WORKER_LOST', "finishedAt" = clock_timestamp()
        WHERE ${orphaned} AND "attempts" >= $2`,
      [String(CHAT_ORPHAN_MS), CHAT_MAX_ATTEMPTS],
    );
    await this.dataSource.query(`UPDATE chat_message SET "status" = 'pending', "claimedAt" = NULL WHERE ${orphaned}`, [
      String(CHAT_ORPHAN_MS),
    ]);
  }

  async heartbeat(messageId: string): Promise<void> {
    await this.dataSource.query(`UPDATE chat_message SET "claimedAt" = clock_timestamp() WHERE id = $1 AND "status" = 'running'`, [
      messageId,
    ]);
  }

  async recordUsage(
    turn: IClaimedTurn,
    usage: { model: string; inputTokens: number; cachedInputTokens?: number; outputTokens: number; costUsd: number },
  ): Promise<void> {
    await this.dataSource.getRepository(ChatUsageEntity).insert({
      userId: turn.userId,
      messageId: turn.id,
      model: usage.model,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens ?? 0,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd.toFixed(6),
    });
  }

  async finishDone(turn: IClaimedTurn, done: ITurnDone): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.update(
        ChatMessageEntity,
        { id: turn.id, status: 'running' },
        {
          status: 'done',
          text: done.text,
          modelContent: [...done.contents],
          model: done.model,
          inputTokens: done.inputTokens,
          outputTokens: done.outputTokens,
          costUsd: done.costUsd.toFixed(6),
          error: null,
          finishedAt: new Date(),
        },
      );
      if (!updated.affected) return false;
      if (done.proposals.length > 0) {
        await manager.insert(
          ChatProposalEntity,
          done.proposals.map((proposal) => ({ messageId: turn.id, status: 'pending' as const, decidedAt: null, cardReplacementId: null, ...proposal })),
        );
      }
      await manager.query(`UPDATE chat_conversation SET "updatedAt" = clock_timestamp() WHERE id = $1`, [turn.conversationId]);
      return true;
    });
  }

  async finishFailed(
    turn: Pick<IClaimedTurn, 'id'>,
    failure: { code: TChatTurnFailureCode; model?: string; inputTokens?: number; outputTokens?: number; costUsd?: number },
  ): Promise<void> {
    await this.dataSource.getRepository(ChatMessageEntity).update(
      { id: turn.id, status: 'running' },
      {
        status: 'failed',
        error: failure.code,
        finishedAt: new Date(),
        ...(failure.model === undefined
          ? {}
          : {
              model: failure.model,
              inputTokens: failure.inputTokens ?? 0,
              outputTokens: failure.outputTokens ?? 0,
              costUsd: (failure.costUsd ?? 0).toFixed(6),
            }),
      },
    );
  }
}
