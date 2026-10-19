import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ShareEventEntity } from '../../database/entities/share-event.entity';
import { ShareEventsService } from '../share-events.service';

const INPUT = {
  kind: 'opened',
  targetKind: 'deck',
  targetId: 3,
  ownerUserId: 'owner-1',
  actorUserId: null,
} as const;

describe('ShareEventsService.record', () => {
  it('inserts one row', async () => {
    const repo = createMock<Repository<ShareEventEntity>>();
    repo.insert.mockResolvedValue({} as never);

    await new ShareEventsService(repo).record(INPUT);

    expect(repo.insert).toHaveBeenCalledWith(INPUT);
  });

  it('never throws to the caller when the insert fails', async () => {
    const repo = createMock<Repository<ShareEventEntity>>();
    repo.insert.mockRejectedValue(new Error('db down'));

    await expect(new ShareEventsService(repo).record(INPUT)).resolves.toBeUndefined();
  });
});
