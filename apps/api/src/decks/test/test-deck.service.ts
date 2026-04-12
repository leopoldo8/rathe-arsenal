import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  catalog,
  computeEffectiveReadiness,
  IEffectiveReadinessResult,
  IReadinessBreakdown,
  ISubstitutedEntry,
} from '@rathe-arsenal/engine';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { FabraryService } from '../../fabrary/fabrary.service';
import { parseFabraryUrl } from '../../fabrary/parse-url';
import {
  EFabraryErrorCode,
  FabraryImportError,
} from '../../fabrary/errors';
import {
  EFetchGuardErrorCode,
  FetchGuardError,
} from '../../common/fetch-guard/errors';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import {
  ITestDeckBreakdown,
  ITestDeckBreakdownEntry,
  ITestDeckResponse,
  ITestDeckSubstitutedEntry,
  ITestDeckSubstitutionMatch,
  TestDeckRequestDto,
} from './dtos/test-deck.dto';

/**
 * Implements R15 "test mode outside of onboarding".
 *
 * Given a Fabrary URL, fetches the deck, loads the caller's collection,
 * computes effective readiness via the Unit 3 engine, and returns the
 * result **without writing anything** to the database. The user's
 * "already tracked" state is looked up so the UI can surface the right
 * CTAs on the result screen.
 *
 * All outbound HTTP happens inside `FabraryService.fetchDeck`, which
 * goes through `AwsIamTransport` -> `FetchGuardService.guardedFetch`.
 * This service contains **zero direct `fetch(` calls**; the SSRF
 * allow-list, redirect-blocking, size cap, and 10s timeout from the
 * Phase 0 S5 guard all apply unchanged to this new attack surface.
 */
@Injectable()
export class TestDeckService {
  private readonly logger = new Logger(TestDeckService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    private readonly fabraryService: FabraryService,
    private readonly shoppingLineService: ShoppingLineService,
  ) {}

  async run(
    dto: TestDeckRequestDto,
    user: { userId: string },
  ): Promise<ITestDeckResponse> {
    const ulid = this.parseUrl(dto.url);

    const deck = await this.fetchDeck(ulid);

    const existing = await this.trackedDeckRepo.findOne({
      where: { userId: user.userId, fabraryUlid: ulid },
    });

    const readiness = await this.computeReadiness(deck, user.userId);

    return await this.buildResponse(deck, readiness, existing);
  }


  private parseUrl(url: string): string {
    try {
      return parseFabraryUrl(url);
    } catch (error) {
      if (error instanceof FabraryImportError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }

  private async fetchDeck(ulid: string): Promise<IDeckImportDto> {
    try {
      return await this.fabraryService.fetchDeck(ulid);
    } catch (error) {
      if (error instanceof FetchGuardError) {
        this.logger.warn({
          msg: 'FetchGuard rejected test-mode Fabrary fetch',
          ulid,
          code: error.code,
          message: error.message,
        });
        throw this.mapFetchGuardError(error);
      }

      if (error instanceof FabraryImportError) {
        this.logger.warn({
          msg: 'Fabrary fetch failed in test mode',
          ulid,
          code: error.code,
          message: error.message,
        });
        throw this.mapFabraryError(error);
      }

      this.logger.error({
        msg: 'Unexpected error fetching deck in test mode',
        ulid,
        error: (error as Error).message,
      });
      throw new BadGatewayException({
        code: 'FABRARY_UNREACHABLE',
        message: 'Could not reach Fabrary',
      });
    }
  }

  private mapFetchGuardError(error: FetchGuardError): Error {
    switch (error.code) {
      case EFetchGuardErrorCode.HostDenied:
      case EFetchGuardErrorCode.RedirectDenied:
      case EFetchGuardErrorCode.TooManyRedirects:
        return new ForbiddenException({
          code: error.code,
          message: error.message,
        });
      case EFetchGuardErrorCode.Timeout:
        return new BadGatewayException({
          code: 'FABRARY_TIMEOUT',
          message: 'Fabrary request timed out',
        });
      case EFetchGuardErrorCode.InvalidUrl:
        return new BadRequestException({
          code: error.code,
          message: error.message,
        });
      case EFetchGuardErrorCode.SizeExceeded:
      case EFetchGuardErrorCode.NetworkError:
      default:
        return new BadGatewayException({
          code: 'FABRARY_UNREACHABLE',
          message: 'Could not reach Fabrary',
        });
    }
  }

  private mapFabraryError(error: FabraryImportError): Error {
    switch (error.code) {
      case EFabraryErrorCode.INVALID_URL:
      case EFabraryErrorCode.INVALID_ULID:
        return new BadRequestException({
          code: error.code,
          message: error.message,
        });
      case EFabraryErrorCode.INVALID_PAYLOAD:
      case EFabraryErrorCode.FETCH_FAILED:
      case EFabraryErrorCode.CREDENTIAL_EXPIRED:
      default:
        return new BadGatewayException({
          code: 'FABRARY_UNREACHABLE',
          message: 'Could not reach Fabrary',
        });
    }
  }

  private async computeReadiness(
    deck: IDeckImportDto,
    userId: string,
  ): Promise<IEffectiveReadinessResult> {
    const collectionRows = await this.collectionCardRepo.find({
      where: { userId },
    });

    const inventory = new Map<string, number>();
    for (const row of collectionRows) {
      inventory.set(row.cardIdentifier, row.quantity);
    }

    const deckCards = this.flattenDeckCards(deck);

    return computeEffectiveReadiness(
      { cards: deckCards },
      inventory,
      catalog,
    );
  }

  private flattenDeckCards(
    deck: IDeckImportDto,
  ): ReadonlyArray<{
    cardIdentifier: string;
    quantity: number;
    slot: 'hero' | 'equipment' | 'weapon' | 'mainboard';
  }> {
    return [
      ...deck.mainboard,
      ...deck.equipment,
      ...deck.weapons,
      {
        cardIdentifier: deck.hero.cardIdentifier,
        quantity: 1,
        slot: 'hero' as const,
      },
    ];
  }

  private async buildResponse(
    deck: IDeckImportDto,
    readiness: IEffectiveReadinessResult,
    existing: TrackedDeckEntity | null,
  ): Promise<ITestDeckResponse> {
    const totalCards = this.flattenDeckCards(deck).reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );

    const breakdown = this.serializeBreakdown(readiness.breakdown);

    // Shopping line derived from the in-memory breakdown — same pattern as
    // DecksService.getDetail(). null = Path A.
    // ITestDeckBreakdown.substituted has a richer shape than IBreakdown.substituted
    // (it carries the full match object). We project it down to IBreakdownEntry.
    const breakdownForShoppingLine = {
      exact: breakdown.exact,
      substituted: breakdown.substituted.map((e) => e.original),
      missing: breakdown.missing,
    };
    const shoppingLine =
      await this.shoppingLineService.computeForBreakdown(
        breakdownForShoppingLine,
      );

    return {
      fabraryUlid: deck.ulid,
      name: deck.name,
      hero: deck.hero.name,
      format: deck.format,
      totalCards,
      rawPercent: readiness.rawPercent,
      effectivePercent: readiness.effectivePercent,
      path: readiness.path,
      fidelityPercent: readiness.fidelityPercent,
      breakdown,
      alreadyTracked: existing !== null,
      trackedDeckId: existing?.id ?? null,
      shoppingLine,
    };
  }

  private serializeBreakdown(
    breakdown: IReadinessBreakdown,
  ): ITestDeckBreakdown {
    return {
      exact: breakdown.exact.map(
        (entry): ITestDeckBreakdownEntry => ({
          cardIdentifier: entry.cardIdentifier,
          quantity: entry.quantity,
          slot: entry.slot,
        }),
      ),
      substituted: breakdown.substituted.map(
        (entry): ITestDeckSubstitutedEntry => ({
          original: {
            cardIdentifier: entry.original.cardIdentifier,
            quantity: entry.original.quantity,
            slot: entry.original.slot,
          },
          match: this.serializeMatch(entry),
        }),
      ),
      missing: breakdown.missing.map(
        (entry): ITestDeckBreakdownEntry => ({
          cardIdentifier: entry.cardIdentifier,
          quantity: entry.quantity,
          slot: entry.slot,
        }),
      ),
    };
  }

  private serializeMatch(
    entry: ISubstitutedEntry,
  ): ITestDeckSubstitutionMatch {
    const substitute = entry.match.substitute;
    return {
      substitute: {
        cardIdentifier: substitute.cardIdentifier,
        name: substitute.name,
        classes: substitute.classes.map((cls) => String(cls)),
        pitch: substitute.pitch,
        power: substitute.power,
        defense: substitute.defense,
        keywords: substitute.keywords.map((kw) => String(kw)),
      },
      tier: entry.match.tier,
      score: entry.match.score,
      rationale: entry.match.rationale,
    };
  }
}
