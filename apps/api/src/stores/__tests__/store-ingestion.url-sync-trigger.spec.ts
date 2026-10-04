import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
} from '../../database/entities';
import { CardNameMatcherService } from '../card-name-matcher.service';
import { SbraubleScraperService } from '../sbrauble-scraper.service';
import { StoreIngestionService, URL_SYNC_STALE_AFTER_MS } from '../store-ingestion.service';

describe('StoreIngestionService — URL-sync trigger', () => {
  let service: StoreIngestionService;
  let storeRepo: { findOne: jest.Mock; update: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    storeRepo = { findOne: jest.fn(), update: jest.fn().mockResolvedValue(undefined), query: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StoreIngestionService,
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreScrapeRunEntity), useValue: createMock<StoreScrapeRunEntity>() },
        { provide: getRepositoryToken(StoreStockEntity), useValue: createMock<StoreStockEntity>() },
        { provide: SbraubleScraperService, useValue: createMock<SbraubleScraperService>() },
        { provide: CardNameMatcherService, useValue: createMock<CardNameMatcherService>() },
        { provide: DataSource, useValue: createMock<DataSource>() },
      ],
    }).compile();
    service = moduleRef.get(StoreIngestionService);
  });

  describe('requestUrlSync', () => {
    it('sets urlSyncRequestedAt on the store', async () => {
      storeRepo.findOne.mockResolvedValue({ id: 7 });
      await service.requestUrlSync('cupula-dt');
      const fields = storeRepo.update.mock.calls[0][1];
      expect(fields.urlSyncRequestedAt).toBeInstanceOf(Date);
    });

    it('throws NotFound for an unknown store', async () => {
      storeRepo.findOne.mockResolvedValue(null);
      await expect(service.requestUrlSync('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimPendingUrlSync', () => {
    it('returns the claimed slug (unwrapping TypeORM UPDATE [rows, count])', async () => {
      storeRepo.query.mockResolvedValue([[{ slug: 'cupula-dt' }], 1]);
      expect(await service.claimPendingUrlSync()).toBe('cupula-dt');
    });

    it('returns null when nothing is queued', async () => {
      storeRepo.query.mockResolvedValue([[], 0]);
      expect(await service.claimPendingUrlSync()).toBeNull();
    });

    it('can take over a running lock left behind by a worker that died mid-sync', async () => {
      storeRepo.query.mockResolvedValue([[], 0]);
      await service.claimPendingUrlSync();
      const [sql, params] = storeRepo.query.mock.calls[0];
      expect(sql).toContain('"urlSyncRunningAt" < now()');
      expect(params).toEqual([String(URL_SYNC_STALE_AFTER_MS)]);
    });
  });

  describe('markUrlSyncFailed', () => {
    it('records the failure message and when it happened', async () => {
      await service.markUrlSyncFailed('cupula-dt', 'Firecrawl returned HTTP 429');
      const [where, fields] = storeRepo.update.mock.calls[0];
      expect(where).toEqual({ slug: 'cupula-dt' });
      expect(fields.lastUrlSyncError).toBe('Firecrawl returned HTTP 429');
      expect(fields.lastUrlSyncErrorAt).toBeInstanceOf(Date);
    });
  });

  describe('getUrlSyncStatus', () => {
    it('reports running when urlSyncRunningAt is set', async () => {
      storeRepo.findOne.mockResolvedValue({
        urlSyncRunningAt: new Date(), urlSyncRequestedAt: null, lastUrlSyncAt: null, lastUrlSyncProductCount: null,
      });
      expect((await service.getUrlSyncStatus('cupula-dt')).state).toBe('running');
    });

    it('reports queued when only requested, and idle otherwise', async () => {
      storeRepo.findOne.mockResolvedValueOnce({ urlSyncRunningAt: null, urlSyncRequestedAt: new Date(), lastUrlSyncAt: null, lastUrlSyncProductCount: null });
      expect((await service.getUrlSyncStatus('cupula-dt')).state).toBe('queued');
      storeRepo.findOne.mockResolvedValueOnce({ urlSyncRunningAt: null, urlSyncRequestedAt: null, lastUrlSyncAt: new Date(), lastUrlSyncProductCount: 42 });
      const idle = await service.getUrlSyncStatus('cupula-dt');
      expect(idle.state).toBe('idle');
      expect(idle.lastProductCount).toBe(42);
      expect(idle.lastError).toBeNull();
    });

    it('reports a lock older than the stale threshold as an interrupted sync, not running', async () => {
      const lockedAt = new Date(Date.now() - URL_SYNC_STALE_AFTER_MS - 60_000);
      storeRepo.findOne.mockResolvedValue({
        urlSyncRunningAt: lockedAt, urlSyncRequestedAt: null, lastUrlSyncAt: null, lastUrlSyncProductCount: null,
        lastUrlSyncError: null, lastUrlSyncErrorAt: null,
      });
      const status = await service.getUrlSyncStatus('cupula-dt');
      expect(status.state).toBe('idle');
      expect(status.lastError).toEqual({
        message: expect.stringContaining('interrupted'),
        at: lockedAt.toISOString(),
      });
    });

    it('reports the last failure message and time', async () => {
      const failedAt = new Date('2026-10-04T16:00:13Z');
      storeRepo.findOne.mockResolvedValue({
        urlSyncRunningAt: null, urlSyncRequestedAt: null, lastUrlSyncAt: null, lastUrlSyncProductCount: null,
        lastUrlSyncError: 'Firecrawl returned HTTP 429', lastUrlSyncErrorAt: failedAt,
      });
      const status = await service.getUrlSyncStatus('cupula-dt');
      expect(status.lastError).toEqual({ message: 'Firecrawl returned HTTP 429', at: failedAt.toISOString() });
    });
  });
});
