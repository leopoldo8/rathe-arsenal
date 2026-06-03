import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { VariantFetchQueueService, RATE_LIMIT_MS } from '../variant-fetch-queue.service';
import { EVariantFetchJobStatus, VariantFetchJobEntity } from '../../database/entities/variant-fetch-job.entity';

describe('VariantFetchQueueService', () => {
  let service: VariantFetchQueueService;
  let repo: jest.Mocked<Repository<VariantFetchJobEntity>>;

  beforeEach(async () => {
    repo = createMock<Repository<VariantFetchJobEntity>>();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantFetchQueueService,
        { provide: getRepositoryToken(VariantFetchJobEntity), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(VariantFetchQueueService);
  });

  it('returns the existing pending/running job for a deck instead of duplicating', async () => {
    const existing = { id: 'job-1', status: EVariantFetchJobStatus.Pending } as VariantFetchJobEntity;
    repo.findOne.mockResolvedValue(existing);
    const result = await service.enqueue('user-uuid-1', 42, 1, [{ cardIdentifier: 'a-red', productUrl: 'u', listingPriceCents: null, listingQuantity: 0 }]);
    expect(result.id).toBe('job-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('computes ETA as remaining cards times the rate limit', () => {
    const eta = service.computeEtaSeconds([
      { total: 10, completed: 4, failed: 0 } as VariantFetchJobEntity,
      { total: 5, completed: 0, failed: 1 } as VariantFetchJobEntity,
    ]);
    expect(eta).toBe(Math.ceil((10 * RATE_LIMIT_MS) / 1000));
  });
});
