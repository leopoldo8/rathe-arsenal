import { EVariantFetchJobStatus, VariantFetchJobEntity } from '../variant-fetch-job.entity';

describe('VariantFetchJobEntity', () => {
  it('exposes the lifecycle status enum values', () => {
    expect(EVariantFetchJobStatus.Pending).toBe('pending');
    expect(EVariantFetchJobStatus.Running).toBe('running');
    expect(EVariantFetchJobStatus.Done).toBe('done');
    expect(EVariantFetchJobStatus.Failed).toBe('failed');
    expect(EVariantFetchJobStatus.Canceled).toBe('canceled');
  });

  it('constructs with default counters', () => {
    const job = new VariantFetchJobEntity();
    job.cards = [{ cardIdentifier: 'a-red', status: 'pending' }];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(job.cards[0]!.cardIdentifier).toBe('a-red');
  });
});
