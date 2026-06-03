import { drainOnce, shouldRunSync } from '../variant-queue-worker';

const URL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // must match the worker constant

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

describe('shouldRunSync', () => {
  it('returns true when lastSyncAt is 0 (startup — never synced)', () => {
    const now = Date.now();
    expect(shouldRunSync(0, now)).toBe(true);
  });

  it('returns true when more than 24h has elapsed since the last sync', () => {
    const now = Date.now();
    const lastSyncAt = now - URL_SYNC_INTERVAL_MS - 1;
    expect(shouldRunSync(lastSyncAt, now)).toBe(true);
  });

  it('returns true when exactly 24h has elapsed', () => {
    const now = Date.now();
    const lastSyncAt = now - URL_SYNC_INTERVAL_MS;
    expect(shouldRunSync(lastSyncAt, now)).toBe(true);
  });

  it('returns false when less than 24h has elapsed since the last sync', () => {
    const now = Date.now();
    const lastSyncAt = now - URL_SYNC_INTERVAL_MS + 1000; // 1 second short
    expect(shouldRunSync(lastSyncAt, now)).toBe(false);
  });

  it('returns false immediately after a sync (elapsed ~ 0)', () => {
    const now = Date.now();
    expect(shouldRunSync(now, now)).toBe(false);
  });
});
