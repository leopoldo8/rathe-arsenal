import {
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { ScrapeResponseDto } from './dtos/scrape-response.dto';
import { StoreIngestionService } from '../store-ingestion.service';

/**
 * 2 requests per hour per IP. A guardrail against accidental repeat
 * invocation of a potentially long-running scrape job.
 */
const HOUR_MS = 60 * 60 * 1000;

/**
 * Admin endpoint for on-demand manual scrape triggers.
 *
 * Authentication stack (evaluation order):
 *   1. Global `ThrottlerGuard` (APP_GUARD): enforces 2/hour per IP.
 *   2. Global `JwtAuthGuard` (APP_GUARD): sees `@Public()` → short-circuits to
 *      true, so a JWT is NOT required on this controller.
 *   3. Controller-level `AdminApiKeyGuard`: always enforces `x-admin-api-key`
 *      header regardless of the `@Public()` flag.
 *
 * This design means the endpoint is reachable without a user JWT but is still
 * protected by the shared-secret key — suitable for operator/cron use where
 * no session exists.
 *
 * `@Public()` is applied so the global JwtAuthGuard does not reject requests
 * that lack a Bearer token. `AdminApiKeyGuard` is the actual access gate.
 *
 * Rate limit: 2 requests per hour per IP (`@Throttle`).
 */
@Controller('admin/stores')
@Public()
@UseGuards(AdminApiKeyGuard)
@Throttle({ default: { limit: 2, ttl: HOUR_MS } })
export class AdminStoresController {
  constructor(private readonly ingestionService: StoreIngestionService) {}

  /**
   * Triggers an immediate scrape run for the named store.
   *
   * `?force=true` bypasses a prior `paused_delta_guard` lock, setting
   * `store_scrape_run.forcedOverride = true` on the created run row so
   * post-incident audits can distinguish normal from forced runs.
   *
   * Returns the run summary on success. Does NOT expose per-product names
   * (counts only).
   */
  @Post(':slug/scrape')
  @HttpCode(HttpStatus.OK)
  async triggerScrape(
    @Param('slug') slug: string,
    @Query('force') force?: string,
  ): Promise<ScrapeResponseDto> {
    const forceFlag = force === 'true';

    try {
      const summary = await this.ingestionService.runScrape(slug, { force: forceFlag });
      return {
        runId: summary.runId,
        productsFetched: summary.productsFetched,
        productsMatched: summary.productsMatched,
        productsUnmatched: summary.productsUnmatched,
        rowsUpserted: summary.rowsUpserted,
        rowsZeroed: summary.rowsZeroed,
        deltaPercent: summary.deltaPercent,
        durationMs: summary.durationMs,
        forcedOverride: summary.forcedOverride,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw err;
    }
  }
}
