import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CHAT_BUDGET_USD, startOfNextUtcMonth, startOfUtcMonth } from './chat-pricing';

export interface IChatUsageResponse {
  readonly spentUsd: number;
  readonly budgetUsd: number;
  readonly resetsAt: string;
}

@Injectable()
export class ChatBudgetService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async spentThisMonth(userId: string, now: Date = new Date(), manager: EntityManager = this.dataSource.manager): Promise<number> {
    const [{ spent }] = (await manager.query(
      `SELECT COALESCE(SUM("costUsd"), 0)::float8 AS spent FROM chat_usage WHERE "userId" = $1 AND "createdAt" >= $2`,
      [userId, startOfUtcMonth(now)],
    )) as [{ spent: number }];
    return spent;
  }

  async isExhausted(userId: string, now: Date = new Date(), manager?: EntityManager): Promise<boolean> {
    return (await this.spentThisMonth(userId, now, manager)) >= CHAT_BUDGET_USD;
  }

  async usage(userId: string, now: Date = new Date()): Promise<IChatUsageResponse> {
    return {
      spentUsd: Math.round((await this.spentThisMonth(userId, now)) * 1_000_000) / 1_000_000,
      budgetUsd: CHAT_BUDGET_USD,
      resetsAt: startOfNextUtcMonth(now).toISOString(),
    };
  }
}
