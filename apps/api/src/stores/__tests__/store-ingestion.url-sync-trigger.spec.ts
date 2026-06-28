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
import { StoreIngestionService } from '../store-ingestion.service';

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
    });
  });
});
