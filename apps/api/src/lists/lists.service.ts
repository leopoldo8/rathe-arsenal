import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { lookupCardInfo } from './card-lookup';
import { ICardList, ICardListSummary } from './dtos/card-list.dto';
import { CreateListDto, UpdateListDto } from './dtos/list-requests.dto';
import { ListAccess } from './list-access.service';
import { ListFromDeckService } from './list-from-deck.service';
import { ListViewService } from './list-view.service';
import { cardListNotFound, sellOnlyField } from './lists-errors';

const DEFAULT_SELL_MULTIPLIER = 7;
const PREVIEW_LINE_COUNT = 3;

interface ISummaryRow {
  id: number;
  kind: CardListEntity['kind'];
  name: string;
  totalPriceCents: number | null;
  updatedAt: Date;
  lineCount: number;
  copyCount: number;
  soldCount: number;
}

interface IPreviewRow {
  listId: number;
  cardIdentifier: string;
}

@Injectable()
export class ListsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: ListAccess,
    private readonly views: ListViewService,
    private readonly fromDeck: ListFromDeckService,
  ) {}

  async summaries(userId: string): Promise<ICardListSummary[]> {
    const rows = (await this.dataSource.query(
      `SELECT l."id", l."kind", l."name", l."totalPriceCents", l."updatedAt",
              COUNT(x."id")::int AS "lineCount",
              COALESCE(SUM(x."quantity"), 0)::int AS "copyCount",
              COALESCE(SUM(x."quantity") FILTER (WHERE x."soldAt" IS NOT NULL), 0)::int AS "soldCount"
         FROM "card_list" l
         LEFT JOIN "card_list_line" x ON x."listId" = l."id"
        WHERE l."userId" = $1
        GROUP BY l."id"
        ORDER BY l."updatedAt" DESC, l."id" DESC`,
      [userId],
    )) as ISummaryRow[];
    if (rows.length === 0) return [];

    const previews = (await this.dataSource.query(
      `SELECT "listId", "cardIdentifier" FROM (
         SELECT "listId", "cardIdentifier",
                row_number() OVER (PARTITION BY "listId" ORDER BY "createdAt", "id") AS rn
           FROM "card_list_line" WHERE "listId" = ANY($1::int[])
       ) first_lines WHERE rn <= $2 ORDER BY "listId", rn`,
      [rows.map((row) => row.id), PREVIEW_LINE_COUNT],
    )) as IPreviewRow[];

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      lineCount: row.lineCount,
      copyCount: row.copyCount,
      soldCount: row.soldCount,
      totalPriceCents: row.totalPriceCents,
      previewImages: previews
        .filter((preview) => preview.listId === row.id)
        .flatMap((preview) => lookupCardInfo(preview.cardIdentifier).imageUrl ?? []),
      shared: false,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  get(userId: string, listId: number): Promise<ICardList> {
    return this.access.read(userId, listId);
  }

  async create(userId: string, dto: CreateListDto): Promise<ICardList> {
    const seeds = dto.fromDeckId === undefined ? [] : await this.fromDeck.linesFor(userId, dto.kind, dto.fromDeckId);
    return this.dataSource.transaction(async (manager) => {
      const list = await manager.save(
        manager.create(CardListEntity, {
          userId,
          kind: dto.kind,
          name: dto.name,
          notes: null,
          totalPriceCents: null,
          priceMultiplier: dto.kind === 'sell' ? DEFAULT_SELL_MULTIPLIER : null,
        }),
      );
      if (seeds.length > 0) {
        await manager.insert(
          CardListLineEntity,
          seeds.map((seed) => ({
            listId: list.id,
            cardIdentifier: seed.cardIdentifier,
            quantity: seed.quantity,
            printing: null,
            condition: null,
            priceCents: null,
            soldAt: null,
          })),
        );
      }
      return this.views.build(manager, list);
    });
  }

  async update(userId: string, listId: number, dto: UpdateListDto): Promise<ICardList> {
    const { list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const sellOnlySent = [dto.totalPriceCents, dto.priceMultiplier].some((value) => value !== undefined && value !== null);
      if (current.kind === 'want' && sellOnlySent) throw sellOnlyField();

      const patch: Partial<Pick<CardListEntity, 'name' | 'notes' | 'totalPriceCents' | 'priceMultiplier'>> = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes === null || dto.notes === '' ? null : dto.notes } : {}),
        ...(dto.totalPriceCents !== undefined ? { totalPriceCents: dto.totalPriceCents } : {}),
        ...(dto.priceMultiplier !== undefined ? { priceMultiplier: dto.priceMultiplier } : {}),
      };
      if (Object.keys(patch).length > 0) await manager.update(CardListEntity, { id: current.id }, patch);
    });
    return list;
  }

  async remove(userId: string, listId: number): Promise<void> {
    const result = await this.dataSource.getRepository(CardListEntity).delete({ id: listId, userId });
    if (result.affected !== 1) throw cardListNotFound();
  }
}
