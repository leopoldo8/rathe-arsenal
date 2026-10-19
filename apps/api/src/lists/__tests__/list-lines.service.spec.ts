import { createMock } from '@golevelup/ts-jest';
import { EntityManager } from 'typeorm';
import { CardListLineEntity } from '../../database/entities/card-list-line.entity';
import { CardListEntity } from '../../database/entities/card-list.entity';
import { ListAccess, IListWriteContext } from '../list-access.service';
import { ListLinesService } from '../list-lines.service';
import { printingsOfCard } from '../printing-key';

const CARD = 'fallen-herald-yellow';
const PRINTING_KEY = printingsOfCard(CARD)?.[0]?.key ?? '';

function line(overrides: Partial<CardListLineEntity>): CardListLineEntity {
  return { id: 1, listId: 1, cardIdentifier: CARD, quantity: 1, printing: null, condition: null, priceCents: null, soldAt: null, ...overrides } as CardListLineEntity;
}

describe('ListLinesService', () => {
  const access = createMock<ListAccess>();
  const manager = createMock<EntityManager>();
  const service = new ListLinesService(access);

  function openList(kind: 'want' | 'sell'): void {
    access.write.mockImplementation(async (_user, _list, work) => {
      const result = await work({ manager, list: { id: 1, kind } as CardListEntity } as IListWriteContext);
      return { result, list: { id: 1 } } as never;
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects an unknown card before touching the list', async () => {
    await expect(service.add('u', 1, { cardIdentifier: 'nope', quantity: 1 })).rejects.toMatchObject({
      response: { code: 'UNKNOWN_CARD' },
    });
    expect(access.write).not.toHaveBeenCalled();
  });

  it('merges into an available line, summing and capping the quantity and keeping the existing price', async () => {
    openList('sell');
    manager.find.mockResolvedValue([line({ id: 9, quantity: 15, priceCents: 500 })]);

    const result = await service.add('u', 1, { cardIdentifier: CARD, quantity: 10, priceCents: 900 });

    expect(result.created).toBe(false);
    expect(manager.update).toHaveBeenCalledWith(CardListLineEntity, { id: 9 }, { quantity: 20, priceCents: 500 });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('creates a new line when the only match is sold', async () => {
    openList('sell');
    manager.find.mockResolvedValue([line({ id: 9, soldAt: new Date() })]);

    const result = await service.add('u', 1, { cardIdentifier: CARD, quantity: 2 });

    expect(result.created).toBe(true);
    expect(manager.insert).toHaveBeenCalledWith(
      CardListLineEntity,
      expect.objectContaining({ listId: 1, quantity: 2, printing: null, condition: null, priceCents: null }),
    );
  });

  it('refuses sell-only fields on a want list but lets null through', async () => {
    openList('want');
    manager.find.mockResolvedValue([]);

    await expect(service.add('u', 1, { cardIdentifier: CARD, quantity: 1, condition: 'NM' })).rejects.toMatchObject({
      response: { code: 'SELL_ONLY_FIELD' },
    });
    await expect(service.add('u', 1, { cardIdentifier: CARD, quantity: 1, condition: null })).resolves.toMatchObject({ created: true });
  });

  it('refuses a printing that is not the card’s own', async () => {
    openList('sell');
    manager.find.mockResolvedValue([]);

    await expect(service.add('u', 1, { cardIdentifier: CARD, quantity: 1, printing: 'NOPE999' })).rejects.toMatchObject({
      response: { code: 'UNKNOWN_PRINTING' },
    });
    await expect(service.add('u', 1, { cardIdentifier: CARD, quantity: 1, printing: PRINTING_KEY })).resolves.toMatchObject({
      created: true,
    });
  });

  it('keeps the first sold timestamp when a sold line is marked sold again', async () => {
    openList('sell');
    const soldAt = new Date('2026-10-01T00:00:00Z');
    manager.findOne.mockResolvedValue(line({ soldAt }));

    await service.update('u', 1, 1, { sold: true });

    expect(manager.update).toHaveBeenCalledWith(CardListLineEntity, { id: 1 }, { soldAt });
  });

  it('answers CARD_LIST_NOT_FOUND for a missing line', async () => {
    openList('sell');
    manager.findOne.mockResolvedValue(null);
    manager.delete.mockResolvedValue({ affected: 0 } as never);

    await expect(service.update('u', 1, 5, { quantity: 2 })).rejects.toMatchObject({ response: { code: 'CARD_LIST_NOT_FOUND' } });
    await expect(service.remove('u', 1, 5)).rejects.toMatchObject({ response: { code: 'CARD_LIST_NOT_FOUND' } });
  });
});
