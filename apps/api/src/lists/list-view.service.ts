import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { lookupCardInfo } from './card-lookup';
import { ICardList, ICardListLine, IPriceSuggestion } from './dtos/card-list.dto';
import { printingsOfCard } from './printing-key';
import { PriceSuggestionService } from '../prices/price-suggestion.service';

@Injectable()
export class ListViewService {
  constructor(private readonly suggestions: PriceSuggestionService) {}

  async build(manager: EntityManager, list: CardListEntity): Promise<ICardList> {
    const lines = await manager.find(CardListLineEntity, {
      where: { listId: list.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const suggestions = await this.suggestions.forLines(list, lines);
    return {
      id: list.id,
      kind: list.kind,
      name: list.name,
      notes: list.notes,
      totalPriceCents: list.totalPriceCents,
      priceMultiplier: list.priceMultiplier,
      lines: lines.map((line) => toLineView(line, suggestions.get(line.id) ?? null)),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

}

function printingLabelOf(line: CardListLineEntity): string | null {
  if (line.printing === null) return null;
  const known = printingsOfCard(line.cardIdentifier)?.find((printing) => printing.key === line.printing);
  return known?.label ?? line.printing;
}

export function toLineView(line: CardListLineEntity, suggestion: IPriceSuggestion | null): ICardListLine {
  return {
    id: line.id,
    cardIdentifier: line.cardIdentifier,
    ...lookupCardInfo(line.cardIdentifier),
    quantity: line.quantity,
    printing: line.printing,
    printingLabel: printingLabelOf(line),
    condition: line.condition,
    priceCents: line.priceCents,
    sold: line.soldAt !== null,
    suggestion,
  };
}
