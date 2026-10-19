import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ICardList } from './dtos/card-list.dto';
import { ListViewService } from './list-view.service';
import { cardListNotFound } from './lists-errors';

export interface IListWriteContext {
  readonly manager: EntityManager;
  readonly list: CardListEntity;
}

@Injectable()
export class ListAccess {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly views: ListViewService,
  ) {}

  async read(userId: string, listId: number): Promise<ICardList> {
    return this.dataSource.transaction(async (manager) => {
      const list = await manager.findOne(CardListEntity, { where: { id: listId, userId } });
      if (!list) throw cardListNotFound();
      return this.views.build(manager, list);
    });
  }

  /**
   * Writes of one list run one at a time (the list row is locked), so two adds of the same card
   * cannot both miss the other and create twins. Every write bumps the list's updatedAt.
   */
  async write<T>(
    userId: string,
    listId: number,
    work: (context: IListWriteContext) => Promise<T>,
  ): Promise<{ result: T; list: ICardList }> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(CardListEntity, {
        where: { id: listId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw cardListNotFound();
      const result = await work({ manager, list: locked });
      await manager.query(`UPDATE "card_list" SET "updatedAt" = now() WHERE "id" = $1`, [listId]);
      const fresh = await manager.findOneByOrFail(CardListEntity, { id: listId });
      return { result, list: await this.views.build(manager, fresh) };
    });
  }
}
