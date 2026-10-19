import { Injectable } from '@nestjs/common';
import { catalog } from '@rathe-arsenal/engine';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ICardList, IListPrintingOption } from './dtos/card-list.dto';
import { AddLineDto, UpdateLineDto } from './dtos/list-requests.dto';
import { ListAccess } from './list-access.service';
import { capQuantity, findMergeCandidate } from './line-math';
import { cardListNotFound, sellOnlyField, unknownCard, unknownPrinting } from './lists-errors';
import { printingsOfCard } from './printing-key';

export interface IAddLineResult {
  list: ICardList;
  created: boolean;
}

interface ISellFields {
  readonly printing?: string | null | undefined;
  readonly condition?: string | null | undefined;
  readonly priceCents?: number | null | undefined;
}

function assertSellFieldsAllowed(list: CardListEntity, fields: ISellFields): void {
  const sent = [fields.printing, fields.condition, fields.priceCents].some((value) => value !== undefined && value !== null);
  if (list.kind === 'want' && sent) throw sellOnlyField();
}

function assertPrintingBelongs(cardIdentifier: string, printing: string | null | undefined): void {
  if (printing === undefined || printing === null) return;
  const known = printingsOfCard(cardIdentifier)?.some((option) => option.key === printing) ?? false;
  if (!known) throw unknownPrinting();
}

@Injectable()
export class ListLinesService {
  constructor(private readonly access: ListAccess) {}

  async add(userId: string, listId: number, dto: AddLineDto): Promise<IAddLineResult> {
    if (!catalog.indices.byIdentifier.has(dto.cardIdentifier)) throw unknownCard();

    const { result, list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      assertSellFieldsAllowed(current, dto);
      assertPrintingBelongs(dto.cardIdentifier, dto.printing);

      const target = {
        cardIdentifier: dto.cardIdentifier,
        printing: dto.printing ?? null,
        condition: dto.condition ?? null,
      };
      const existing = await manager.find(CardListLineEntity, { where: { listId: current.id, cardIdentifier: dto.cardIdentifier } });
      const match = findMergeCandidate(
        current.kind,
        existing.map((line) => ({ ...line, sold: line.soldAt !== null })),
        target,
      );

      if (match) {
        const quantity = capQuantity(match.quantity + dto.quantity);
        const priceCents = match.priceCents ?? dto.priceCents ?? null;
        await manager.update(CardListLineEntity, { id: match.id }, { quantity, priceCents });
        return { created: false };
      }

      await manager.insert(CardListLineEntity, {
        listId: current.id,
        ...target,
        quantity: dto.quantity,
        priceCents: dto.priceCents ?? null,
        soldAt: null,
      });
      return { created: true };
    });
    return { list, created: result.created };
  }

  async update(userId: string, listId: number, lineId: number, dto: UpdateLineDto): Promise<ICardList> {
    const { list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const line = await manager.findOne(CardListLineEntity, { where: { id: lineId, listId: current.id } });
      if (!line) throw cardListNotFound();

      assertSellFieldsAllowed(current, dto);
      assertPrintingBelongs(line.cardIdentifier, dto.printing);

      const patch: Partial<Omit<CardListLineEntity, 'id' | 'listId' | 'list' | 'createdAt'>> = {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.printing !== undefined ? { printing: dto.printing } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.sold === undefined ? {} : { soldAt: dto.sold ? (line.soldAt ?? new Date()) : null }),
      };
      if (Object.keys(patch).length > 0) await manager.update(CardListLineEntity, { id: line.id }, patch);
    });
    return list;
  }

  async remove(userId: string, listId: number, lineId: number): Promise<ICardList> {
    const { list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const result = await manager.delete(CardListLineEntity, { id: lineId, listId: current.id });
      if (result.affected !== 1) throw cardListNotFound();
    });
    return list;
  }

  async printings(userId: string, listId: number, cardIdentifier: string): Promise<IListPrintingOption[]> {
    await this.access.read(userId, listId);
    const printings = printingsOfCard(cardIdentifier);
    if (!printings) throw unknownCard();
    return printings.map((printing) => ({ printing: printing.key, label: printing.label, suggestion: null }));
  }
}
