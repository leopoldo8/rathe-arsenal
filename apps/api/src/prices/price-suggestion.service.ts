import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { CardPriceEntity } from '../database/entities/card-price.entity';
import { IPriceSuggestion } from '../lists/dtos/card-list.dto';
import { EDITION_NAMES, FOILING_NAMES, ICardPrinting, printingsOfCard } from '../lists/printing-key';
import { pickPrice, TPriceIndex, priceIndexKey, priceKeysOf, suggestPrice } from './price-suggestion';

export interface IVersionToPrice {
  readonly cardIdentifier: string;
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
}

/** The printings a version can be: each part it names narrows the list; `none` is the printing with no foiling. */
export function printingsOfVersion(version: IVersionToPrice, printings: readonly ICardPrinting[]): readonly ICardPrinting[] {
  const matching = printings.filter(
    (printing) =>
      (version.printingCode === '' || printing.identifier === version.printingCode) &&
      (version.edition === '' || printing.edition === EDITION_NAMES[version.edition]) &&
      (version.finish === '' || (version.finish === 'none' ? printing.foiling === null : printing.foiling === FOILING_NAMES[version.finish])),
  );
  return matching.length > 0 ? matching : printings;
}

export function versionPriceKey(version: IVersionToPrice): string {
  return [version.cardIdentifier, version.printingCode, version.edition, version.finish].join('|');
}

export interface IMarketPrice {
  readonly usdCents: number;
  readonly approximate: boolean;
  readonly printing: string;
  readonly fetchedAt: string;
}

@Injectable()
export class PriceSuggestionService {
  constructor(@InjectRepository(CardPriceEntity) private readonly prices: Repository<CardPriceEntity>) {}

  /** Computed on read from the shared snapshot and the list's multiplier; nothing is stored. Sell lists only. */
  async forLines(
    list: Pick<CardListEntity, 'kind' | 'priceMultiplier'>,
    lines: readonly Pick<CardListLineEntity, 'id' | 'cardIdentifier' | 'printingCode' | 'edition' | 'finish'>[],
  ): Promise<Map<number, IPriceSuggestion>> {
    const result = new Map<number, IPriceSuggestion>();
    const multiplier = list.priceMultiplier;
    if (list.kind !== 'sell' || multiplier === null || lines.length === 0) return result;

    const printingsByCard = new Map(
      lines.map((line) => [line.cardIdentifier, printingsOfCard(line.cardIdentifier) ?? []] as const),
    );
    const index = await this.loadIndex([...printingsByCard.values()].flat());
    for (const line of lines) {
      const pool = printingsOfVersion(line, printingsByCard.get(line.cardIdentifier) ?? []);
      const suggestion = suggestPrice(pool, null, index, multiplier);
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

  /** The TCGplayer price in USD cents of each card's cheapest non-foil printing, as the sell-list suggestion picks it, before any multiplier. */
  async marketPrices(cardIdentifiers: readonly string[]): Promise<Map<string, IMarketPrice>> {
    const printingsByCard = new Map(cardIdentifiers.map((cardIdentifier) => [cardIdentifier, printingsOfCard(cardIdentifier) ?? []] as const));
    const index = await this.loadIndex([...printingsByCard.values()].flat());
    const result = new Map<string, IMarketPrice>();
    for (const [cardIdentifier, printings] of printingsByCard) {
      const picked = pickPrice(printings, null, index);
      if (picked) {
        result.set(cardIdentifier, {
          usdCents: picked.usdCents,
          approximate: picked.approximate,
          printing: picked.printing.label,
          fetchedAt: picked.snapshot.fetchedAt.toISOString(),
        });
      }
    }
    return result;
  }

  /** One suggestion per card version, TCGplayer in dollars times `multiplier`; a version no printing prices has none. */
  async forVersions(versions: readonly IVersionToPrice[], multiplier: number): Promise<Map<string, IPriceSuggestion>> {
    const printingsByCard = new Map(
      versions.map((version) => [version.cardIdentifier, printingsOfCard(version.cardIdentifier) ?? []] as const),
    );
    const index = await this.loadIndex([...printingsByCard.values()].flat());
    const result = new Map<string, IPriceSuggestion>();
    for (const version of versions) {
      const pool = printingsOfVersion(version, printingsByCard.get(version.cardIdentifier) ?? []);
      const suggestion = suggestPrice(pool, null, index, multiplier);
      if (suggestion) result.set(versionPriceKey(version), suggestion);
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
