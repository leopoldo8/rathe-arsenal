import { drainOnce } from '../variant-queue-worker';

describe('drainOnce', () => {
  it('reclaims orphans, claims a job, resolves its cards, and processes it', async () => {
    const claimed = { id: 'job-1', deckId: 42, storeId: 1, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] };
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(claimed) };
    const processor = { process: jest.fn() };
    const resolveCards = jest.fn().mockResolvedValue([{ cardIdentifier: 'a-red', productUrl: 'u', listingPriceCents: null, listingQuantity: 0 }]);
    await drainOnce({ queue, processor, resolveCards, workerId: 'w1' } as never);
    expect(queue.reclaimOrphans).toHaveBeenCalled();
    expect(queue.claimNext).toHaveBeenCalledWith('w1');
    expect(processor.process).toHaveBeenCalledWith(claimed, expect.arrayContaining([expect.objectContaining({ cardIdentifier: 'a-red' })]));
  });

  it('does nothing further when the queue is empty', async () => {
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) };
    const processor = { process: jest.fn() };
    await drainOnce({ queue, processor, resolveCards: jest.fn(), workerId: 'w1' } as never);
    expect(processor.process).not.toHaveBeenCalled();
  });
});
