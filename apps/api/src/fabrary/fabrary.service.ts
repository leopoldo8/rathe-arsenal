import { Injectable, Logger } from '@nestjs/common';
import { Type } from '@rathe-arsenal/engine';
import { CatalogService } from '../catalog/catalog.service';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { AwsIamTransport } from './aws-iam.transport';
import { IDeckCardEntry, IDeckImportDto } from './dtos/deck-import.dto';
import { EFabraryErrorCode, FabraryImportError } from './errors';
import { GET_DECK_QUERY } from './queries/get-deck.query';

interface IRawDeckCard {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly sideboardQuantity: number;
}

interface IRawDeckResponse {
  readonly data?: {
    readonly getDeck?: {
      readonly deckId: string;
      readonly name: string;
      readonly format: string;
      readonly heroIdentifier: string;
      readonly hero: { readonly cardIdentifier: string; readonly name: string };
      readonly deckCards: readonly IRawDeckCard[];
    };
  };
  readonly errors?: readonly { readonly message: string }[];
}

const WEAPON_SUBTYPES = new Set([
  '1H',
  '2H',
  'Dagger',
  'Bow',
  'Staff',
  'Claw',
  'Flail',
  'Gun',
  'Hammer',
  'Axe',
  'Sword',
  'Scepter',
  'Pistol',
  'Scythe',
  'Orb',
]);

@Injectable()
export class FabraryService {
  private readonly logger = new Logger(FabraryService.name);

  constructor(
    private readonly transport: AwsIamTransport,
    private readonly catalogService: CatalogService,
  ) {}

  async fetchDeck(ulid: string): Promise<IDeckImportDto> {
    this.logger.log({ msg: 'Fetching deck from Fabrary', ulid });

    const body = JSON.stringify({
      query: GET_DECK_QUERY,
      variables: { deckId: ulid },
    });

    let raw: unknown;
    try {
      raw = await this.transport.post(body);
    } catch (error) {
      if (error instanceof FabraryImportError) {
        throw error;
      }
      throw new FabraryImportError(
        EFabraryErrorCode.FETCH_FAILED,
        `Failed to fetch deck: ${(error as Error).message}`,
      );
    }

    const response = raw as IRawDeckResponse;

    if (response.errors?.length) {
      const messages = response.errors.map((e) => e.message).join('; ');
      throw new FabraryImportError(
        EFabraryErrorCode.INVALID_PAYLOAD,
        `GraphQL errors: ${messages}`,
      );
    }

    const deck = response.data?.getDeck;
    if (!deck) {
      throw new FabraryImportError(
        EFabraryErrorCode.INVALID_PAYLOAD,
        'GraphQL response missing getDeck data',
      );
    }

    if (!deck.hero?.cardIdentifier || !deck.deckCards) {
      throw new FabraryImportError(
        EFabraryErrorCode.INVALID_PAYLOAD,
        'Deck response missing hero or deckCards',
      );
    }

    const mainboard: IDeckCardEntry[] = [];
    const equipment: IDeckCardEntry[] = [];
    const weapons: IDeckCardEntry[] = [];

    for (const rawCard of deck.deckCards) {
      // Skip sideboard-only cards
      if (rawCard.quantity === 0 && rawCard.sideboardQuantity > 0) {
        this.logger.debug({
          msg: 'Skipping sideboard-only card',
          cardIdentifier: rawCard.cardIdentifier,
          sideboardQuantity: rawCard.sideboardQuantity,
        });
        continue;
      }

      if (rawCard.quantity === 0) {
        continue;
      }

      let catalogCard;
      try {
        catalogCard = this.catalogService.getCard(rawCard.cardIdentifier);
      } catch (error) {
        if (error instanceof CardNotFoundError) {
          this.logger.warn({
            msg: 'Unknown card dropped from import',
            cardIdentifier: rawCard.cardIdentifier,
            quantity: rawCard.quantity,
          });
          continue;
        }
        throw error;
      }

      const slot = this.classifyCard(catalogCard.types, catalogCard.subtypes);
      const entry: IDeckCardEntry = {
        cardIdentifier: rawCard.cardIdentifier,
        quantity: rawCard.quantity,
        slot,
      };

      switch (slot) {
        case 'equipment':
          equipment.push(entry);
          break;
        case 'weapon':
          weapons.push(entry);
          break;
        case 'hero':
          // Hero cards in deckCards are handled separately via deck.hero
          break;
        default:
          mainboard.push(entry);
          break;
      }
    }

    const result: IDeckImportDto = {
      ulid,
      name: deck.name,
      format: deck.format,
      hero: {
        cardIdentifier: deck.hero.cardIdentifier,
        name: deck.hero.name,
      },
      mainboard,
      equipment,
      weapons,
    };

    this.logger.log({
      msg: 'Deck imported successfully',
      ulid,
      name: deck.name,
      mainboardCount: mainboard.length,
      equipmentCount: equipment.length,
      weaponCount: weapons.length,
    });

    return result;
  }

  private classifyCard(
    types: readonly string[],
    subtypes: readonly string[],
  ): 'hero' | 'equipment' | 'weapon' | 'mainboard' {
    if (types.includes(Type.Hero)) {
      return 'hero';
    }

    if (types.includes(Type.Equipment)) {
      return 'equipment';
    }

    if (types.includes(Type.Weapon)) {
      return 'weapon';
    }

    // Check subtypes for weapon indicators (some cards may have weapon subtypes
    // without the Weapon type)
    const hasWeaponSubtype = subtypes.some((st) => WEAPON_SUBTYPES.has(st));
    if (hasWeaponSubtype) {
      return 'weapon';
    }

    return 'mainboard';
  }
}
