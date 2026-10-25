import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { lookupCardInfo } from './card-lookup';
import { ICardList, ICardListLine, IPriceSuggestion } from './dtos/card-list.dto';
import { printingKeyOfVersion, printingsOfCard } from './printing-key';
import { PriceSuggestionService } from '../prices/price-suggestion.service';
import { CollectionReadService } from '../collection/collection-read.service';

@Injectable()
export class ListViewService {
  constructor(
    private readonly suggestions: PriceSuggestionService,
    private readonly collection: CollectionReadService,
  ) {}

  async build(manager: EntityManager, list: CardListEntity): Promise<ICardList> {
    const lines = await manager.find(CardListLineEntity, {
      where: { listId: list.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const suggestions = await this.suggestions.forLines(list, lines);
    // A sell line may list more copies than the collection holds; the line says how many the collection has.
    const owned =
      list.kind === 'sell' && lines.length > 0
        ? await this.collection.loadOwned(list.userId, [...new Set(lines.map((line) => line.cardIdentifier))])
        : null;
    return {
      id: list.id,
      kind: list.kind,
      name: list.name,
      notes: list.notes,
      totalPriceCents: list.totalPriceCents,
      priceMultiplier: list.priceMultiplier,
      lines: lines.map((line) => toLineView(line, suggestions.get(line.id) ?? null, owned === null ? null : (owned.get(line.cardIdentifier) ?? 0))),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

}

/** The printing key a line's version points at, or null while the line names no printing code. */
export function printingKeyOf(line: CardListLineEntity): string | null {
  return printingKeyOfVersion(line);
}

export function printingLabelOf(line: CardListLineEntity): string | null {
  const key = printingKeyOf(line);
  if (key === null) return null;
  const known = printingsOfCard(line.cardIdentifier)?.find((printing) => printing.key === key);
  return known?.label ?? key;
}

export function toLineView(line: CardListLineEntity, suggestion: IPriceSuggestion | null, owned: number | null = null): ICardListLine {
  return {
    id: line.id,
    cardIdentifier: line.cardIdentifier,
    ...lookupCardInfo(line.cardIdentifier),
    quantity: line.quantity,
    printingCode: line.printingCode,
    edition: line.edition,
    finish: line.finish,
    printing: printingKeyOf(line),
    printingLabel: printingLabelOf(line),
    condition: line.condition,
    priceCents: line.priceCents,
    sold: line.soldAt !== null,
    suggestion,
    owned,
  };
}
