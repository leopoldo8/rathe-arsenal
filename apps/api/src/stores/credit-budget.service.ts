import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirecrawlUsageEntity } from '../database/entities/firecrawl-usage.entity';
import { RECORD_CREDITS_SQL } from './credit-usage.sql';
import { readStoreAnswersConfig } from './store-answers.config';

export interface ICreditStatus {
  readonly creditsUsed: number;
  readonly budget: number;
  readonly lookupsStopped: boolean;
}

export function monthOf(now: Date): string {
  return now.toISOString().slice(0, 7);
}

@Injectable()
export class CreditBudgetService {
  private readonly logger = new Logger(CreditBudgetService.name);
  private warnedMonth: string | null = null;

  constructor(
    @InjectRepository(FirecrawlUsageEntity)
    private readonly usageRepo: Repository<FirecrawlUsageEntity>,
    private readonly config: ConfigService,
  ) {}

  async record(credits: number, now: Date = new Date()): Promise<void> {
    if (credits <= 0) return;
    await this.usageRepo.query(RECORD_CREDITS_SQL, [monthOf(now), credits]);
  }

  async status(now: Date = new Date()): Promise<ICreditStatus> {
    const { monthlyCreditBudget, creditsPerPass } = readStoreAnswersConfig(this.config);
    const creditsUsed = await this.creditsUsed(now);
    return {
      creditsUsed,
      budget: monthlyCreditBudget,
      lookupsStopped: monthlyCreditBudget - creditsUsed < creditsPerPass,
    };
  }

  async passFits(now: Date = new Date()): Promise<boolean> {
    return !(await this.status(now)).lookupsStopped;
  }

  async allowAutomaticLookups(now: Date = new Date()): Promise<boolean> {
    const status = await this.status(now);
    if (!status.lookupsStopped) return true;
    const month = monthOf(now);
    if (this.warnedMonth !== month) {
      this.warnedMonth = month;
      this.logger.warn({
        event: 'firecrawl.lookups_stopped',
        month,
        creditsUsed: status.creditsUsed,
        budget: status.budget,
      });
    }
    return false;
  }

  private async creditsUsed(now: Date): Promise<number> {
    const row = await this.usageRepo.findOne({ where: { month: monthOf(now) } });
    return row?.credits ?? 0;
  }
}
