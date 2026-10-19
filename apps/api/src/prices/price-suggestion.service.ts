import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { CardPriceEntity } from '../database/entities/card-price.entity';
import { IPriceSuggestion } from '../lists/dtos/card-list.dto';
import { ICardPrinting, printingsOfCard } from '../lists/printing-key';
import { TPriceIndex, priceIndexKey, priceKeysOf, suggestPrice } from './price-suggestion';

@Injectable()
export class PriceSuggestionService {
  constructor(@InjectRepository(CardPriceEntity) private readonly prices: Repository<CardPriceEntity>) {}

  /** Computed on read from the shared snapshot and the list's multiplier; nothing is stored. Sell lists only. */
  async forLines(
    list: Pick<CardListEntity, 'kind' | 'priceMultiplier'>,
    lines: readonly Pick<CardListLineEntity, 'id' | 'cardIdentifier' | 'printing'>[],
  ): Promise<Map<number, IPriceSuggestion>> {
    const result = new Map<number, IPriceSuggestion>();
    const multiplier = list.priceMultiplier;
    if (list.kind !== 'sell' || multiplier === null || lines.length === 0) return result;

    const printingsByCard = new Map(
      lines.map((line) => [line.cardIdentifier, printingsOfCard(line.cardIdentifier) ?? []] as const),
    );
    const index = await this.loadIndex([...printingsByCard.values()].flat());
    for (const line of lines) {
      const suggestion = suggestPrice(printingsByCard.get(line.cardIdentifier) ?? [], line.printing, index, multiplier);
      if (suggestion) result.set(line.id, suggestion);
    }
    return result;
  }

  /** One suggestion per printing of the card, each priced from its own row. */
  async forPrintings(
    list: { readonly kind: string; readonly priceMultiplier: number | null },
    printings: readonly ICardPrinting[],
  ): Promise<Map<string, IPriceSuggestion>> {
    const result = new Map<string, IPriceSuggestion>();
    const multiplier = list.priceMultiplier;
    if (list.kind !== 'sell' || multiplier === null) return result;

    const index = await this.loadIndex(printings);
    for (const printing of printings) {
      const suggestion = suggestPrice(printings, printing.key, index, multiplier);
      if (suggestion) result.set(printing.key, suggestion);
    }
    return result;
  }

  private async loadIndex(printings: readonly ICardPrinting[]): Promise<TPriceIndex> {
    const wanted = new Set(printings.flatMap((printing) => priceKeysOf(printing) ?? []));
    const productIds = [...new Set(printings.flatMap((printing) => printing.productId ?? []))];
    if (productIds.length === 0) return new Map();
    const rows = await this.prices.find({ where: { productId: In(productIds) } });
    return new Map(
      rows
        .filter((row) => wanted.has(priceIndexKey(row.productId, row.subType)))
        .map((row) => [priceIndexKey(row.productId, row.subType), row] as const),
    );
  }
}
