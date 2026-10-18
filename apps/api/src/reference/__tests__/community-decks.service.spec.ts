import { createMock } from '@golevelup/ts-jest';
import { FabraryService } from '../../fabrary/fabrary.service';
import { COMMUNITY_CACHE_MS, CommunityDecksService } from '../community-decks.service';
import { FabraryIndexClient, IIndexRequest, IIndexResult } from '../fabrary-index';

const NOW = new Date('2026-10-18T12:00:00Z');

function serviceWith(query: (request: IIndexRequest) => Promise<IIndexResult>): CommunityDecksService {
  const index = { query } as unknown as FabraryIndexClient;
  return new CommunityDecksService(index, createMock<FabraryService>());
}

describe('CommunityDecksService', () => {
  it('answers the same hero and format from memory for six hours, then asks Fabrary again', async () => {
    const query = jest.fn(async (): Promise<IIndexResult> => ({ nbHits: 0, hits: [] }));
    const service = serviceWith(query);

    await service.latest('azalea', 'Silver Age', NOW);
    await service.latest('azalea', 'Silver Age', new Date(NOW.getTime() + COMMUNITY_CACHE_MS - 1));
    await service.latest('azalea', 'Blitz', NOW);
    await service.latest('azalea', 'Silver Age', new Date(NOW.getTime() + COMMUNITY_CACHE_MS));

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('returns null when Fabrary fails and does not remember the failure', async () => {
    const query = jest.fn(async (): Promise<IIndexResult> => {
      throw new Error('index down');
    });
    const service = serviceWith(query);

    expect(await service.latest('azalea', 'Silver Age', NOW)).toBeNull();
    expect(await service.latest('azalea', 'Silver Age', NOW)).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
