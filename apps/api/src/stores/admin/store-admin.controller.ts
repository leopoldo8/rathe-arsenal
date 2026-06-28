import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { StoreIngestionService, IUrlSyncStatus } from '../store-ingestion.service';

/**
 * Admin-role store operations, gated by JWT (global guard) + AdminGuard
 * (user.role === 'admin'). Distinct from AdminStoresController, which is gated
 * by the operator shared-secret (x-admin-api-key) for headless/cron use.
 *
 * The URL sync is queued here and runs in the background worker — it is a long
 * (~minutes) Firecrawl crawl, so the request returns 202 immediately rather
 * than holding the connection open.
 */
@Controller('admin/stores')
@UseGuards(AdminGuard)
export class StoreAdminController {
  constructor(private readonly ingestion: StoreIngestionService) {}

  @Post(':slug/url-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerUrlSync(@Param('slug') slug: string): Promise<{ status: 'queued' }> {
    await this.ingestion.requestUrlSync(slug);
    return { status: 'queued' };
  }

  @Get(':slug/url-sync-status')
  async getUrlSyncStatus(@Param('slug') slug: string): Promise<IUrlSyncStatus> {
    return this.ingestion.getUrlSyncStatus(slug);
  }
}
