import { Injectable } from '@nestjs/common';
import { catalog } from '@rathe-arsenal/engine';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ICardList, IListPrintingOption } from './dtos/card-list.dto';
import { AddLineDto, UpdateLineDto } from './dtos/list-requests.dto';
import { ListAccess } from './list-access.service';
import { capQuantity, findMergeCandidate } from './line-math';
import { cardListNotFound, sellOnlyField, unknownCard, unknownPrinting } from './lists-errors';
import { printingsOfCard, printingVersion } from './printing-key';
import { cardHasPrinting } from '../catalog/card-version-options';
import { ICopyVersion, NO_VERSION } from '../collection/versions/copy-version';
import { PriceSuggestionService } from '../prices/price-suggestion.service';

export interface IAddLineResult {
  list: ICardList;
  created: boolean;
}

interface ISellFields {
  readonly printingCode?: string | undefined;
  readonly edition?: string | undefined;
  readonly finish?: string | undefined;
  readonly condition?: string | null | undefined;
  readonly priceCents?: number | null | undefined;
}

function assertSellFieldsAllowed(list: CardListEntity, fields: ISellFields): void {
  const named = [fields.printingCode, fields.edition, fields.finish, fields.condition].some((value) => value !== undefined && value !== null && value !== '');
  const sent = named || (fields.priceCents !== undefined && fields.priceCents !== null);
  if (list.kind === 'want' && sent) throw sellOnlyField();
}

/** Throws 400 when the card has no printing carrying every part of the version the line names. */
function assertVersionBelongs(cardIdentifier: string, version: Pick<ICopyVersion, 'printingCode' | 'edition' | 'finish'>): void {
  const named = version.printingCode !== '' || version.edition !== '' || version.finish !== '';
  if (named && !cardHasPrinting(cardIdentifier, version)) throw unknownPrinting();
}

@Injectable()
export class ListLinesService {
  constructor(
    private readonly access: ListAccess,
    private readonly prices: PriceSuggestionService,
  ) {}

  async add(userId: string, listId: number, dto: AddLineDto): Promise<IAddLineResult> {
    if (!catalog.indices.byIdentifier.has(dto.cardIdentifier)) throw unknownCard();

    const { result, list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      assertSellFieldsAllowed(current, dto);
      const version = {
        printingCode: dto.printingCode ?? NO_VERSION.printingCode,
        edition: dto.edition ?? NO_VERSION.edition,
        finish: dto.finish ?? NO_VERSION.finish,
      };
      assertVersionBelongs(dto.cardIdentifier, version);

      const target = {
        cardIdentifier: dto.cardIdentifier,
        ...version,
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
      assertVersionBelongs(line.cardIdentifier, {
        printingCode: dto.printingCode ?? line.printingCode,
        edition: dto.edition ?? line.edition,
        finish: dto.finish ?? line.finish,
      });

      const patch: Partial<Omit<CardListLineEntity, 'id' | 'listId' | 'list' | 'createdAt'>> = {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.printingCode !== undefined ? { printingCode: dto.printingCode } : {}),
        ...(dto.edition !== undefined ? { edition: dto.edition } : {}),
        ...(dto.finish !== undefined ? { finish: dto.finish } : {}),
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
    const list = await this.access.read(userId, listId);
    const printings = printingsOfCard(cardIdentifier);
    if (!printings) throw unknownCard();
    const suggestions = await this.prices.forPrintings(list, printings);
    return printings.map((printing) => ({
      printing: printing.key,
      ...printingVersion(printing),
      label: printing.label,
      suggestion: suggestions.get(printing.key) ?? null,
    }));
  }

  /** Writes the suggestion as the line's price. Without ids, every available line that has a suggestion. */
  async applySuggestions(userId: string, listId: number, lineIds: readonly number[] | undefined): Promise<ICardList> {
    const { list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const lines = await manager.find(CardListLineEntity, { where: { listId: current.id } });
      const targets = lines.filter((line) =>
        lineIds === undefined ? line.soldAt === null && line.priceCents === null : lineIds.includes(line.id),
      );
      const suggestions = await this.prices.forLines(current, targets);
      for (const [lineId, suggestion] of suggestions) {
        await manager.update(CardListLineEntity, { id: lineId }, { priceCents: suggestion.cents });
      }
    });
    return list;
  }
}
