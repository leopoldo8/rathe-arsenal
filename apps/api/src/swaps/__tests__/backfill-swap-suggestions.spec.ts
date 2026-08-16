import { backfillSwapSuggestions } from '../backfill-swap-suggestions';

describe('backfillSwapSuggestions', () => {
  it('calls computeAndStoreReadiness once per tracked deck and reports a success summary', async () => {
    const decks = [
      { id: 1, userId: 'user-a' },
      { id: 2, userId: 'user-b' },
    ];
    const trackedDeckRepo = { find: jest.fn().mockResolvedValue(decks) };
    const substitutionService = { computeAndStoreReadiness: jest.fn().mockResolvedValue({}) };
    const logger = { log: jest.fn(), warn: jest.fn() };

    const summary = await backfillSwapSuggestions({
      trackedDeckRepo,
      substitutionService,
      logger,
    } as never);

    expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(2);
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenNthCalledWith(1, 1, 'user-a');
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenNthCalledWith(2, 2, 'user-b');
    expect(summary).toEqual({ totalDecks: 2, succeeded: 2, failed: 0 });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'backfill-swap-suggestions.completed', succeeded: 2, failed: 0 }),
    );
  });

  it('continues past a failing deck and reports it in the summary without throwing', async () => {
    const decks = [
      { id: 1, userId: 'user-a' },
      { id: 2, userId: 'user-b' },
      { id: 3, userId: 'user-c' },
    ];
    const trackedDeckRepo = { find: jest.fn().mockResolvedValue(decks) };
    const computeAndStoreReadiness = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('catalog lookup failed'))
      .mockResolvedValueOnce({});
    const substitutionService = { computeAndStoreReadiness };
    const logger = { log: jest.fn(), warn: jest.fn() };

    const summary = await backfillSwapSuggestions({
      trackedDeckRepo,
      substitutionService,
      logger,
    } as never);

    expect(computeAndStoreReadiness).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({ totalDecks: 3, succeeded: 2, failed: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'backfill-swap-suggestions.deck_failed',
        trackedDeckId: 2,
        error: 'catalog lookup failed',
      }),
    );
  });

  it('reports an all-zero summary when there are no tracked decks', async () => {
    const trackedDeckRepo = { find: jest.fn().mockResolvedValue([]) };
    const substitutionService = { computeAndStoreReadiness: jest.fn() };
    const logger = { log: jest.fn(), warn: jest.fn() };

    const summary = await backfillSwapSuggestions({
      trackedDeckRepo,
      substitutionService,
      logger,
    } as never);

    expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    expect(summary).toEqual({ totalDecks: 0, succeeded: 0, failed: 0 });
  });
});
