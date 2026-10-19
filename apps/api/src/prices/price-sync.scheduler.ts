import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceSyncService } from './price-sync.service';

export const PRICE_SYNC_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class PriceSyncScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PriceSyncScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sync: PriceSyncService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<boolean>('PRICE_SYNC_ENABLED') !== true) return;
    this.logger.log({ event: 'prices.sync.enabled', everyMs: PRICE_SYNC_INTERVAL_MS });
    void this.sync.runOnce();
    this.timer = setInterval(() => void this.sync.runOnce(), PRICE_SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
