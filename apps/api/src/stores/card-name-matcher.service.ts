import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CardAliasEntity } from '../database/entities';
import { CatalogService } from '../catalog/catalog.service';
import {
  CONTROL_CHAR_RE,
  LEADING_QUANTITY_RE,
  PITCH_COLOR_MAP,
  RAW_NAME_MAX_LOG_LENGTH,
  STRIPPABLE_SUFFIXES,
} from './card-name-matcher.constants';

export interface ICardMatchResult {
  readonly cardIdentifier: string;
  readonly source: 'alias' | 'deterministic';
}

/**
 * Resolves a raw store product name to a canonical `@flesh-and-blood/cards`
 * `cardIdentifier` using a two-stage strategy:
 *
 * Stage 1 — alias table: query `card_alias` by `(sourceSlug, rawName)`.
 *   If found AND the target still exists in the catalog, return it.
 *   A stale alias (target gone from catalog) logs a warn with tag
 *   `alias-target-missing` and falls through to Stage 2.
 *
 * Stage 2 — deterministic parse:
 *   1. Strip leading quantity prefix (`/^\d+\s+/`).
 *   2. Strip known foil/variant suffixes (case-insensitive).
 *   3. Extract pitch color label → identifier suffix.
 *   4. Apply canonical kebab transform.
 *   5. Look up in catalog; return match or null.
 *
 * Returns `null` on no match and emits a `warn`-level log with sanitized
 * rawName so the operator can populate the alias table.
 *
 * See `card-name-matcher.constants.ts` for spike findings and transform rules.
 */
@Injectable()
export class CardNameMatcherService {
  private readonly logger = new Logger(CardNameMatcherService.name);

  constructor(
    @InjectRepository(CardAliasEntity)
    private readonly aliasRepo: Repository<CardAliasEntity>,
    private readonly catalogService: CatalogService,
  ) {}

  async match(
    sourceSlug: string,
    rawName: string,
  ): Promise<ICardMatchResult | null> {
    if (!rawName || rawName.trim().length === 0) {
      this.logger.warn('Empty rawName received', { sourceSlug });
      return null;
    }

    // Stage 1: alias table lookup
    const aliasResult = await this.tryAliasLookup(sourceSlug, rawName);
    if (aliasResult !== undefined) {
      return aliasResult;
    }

    // Stage 2: deterministic parse
    const deterministicResult = this.tryDeterministicMatch(rawName);
    if (deterministicResult !== null) {
      return deterministicResult;
    }

    this.logger.warn('No match found for product name', {
      sourceSlug,
      rawName: sanitizeForLog(rawName),
    });
    return null;
  }

  /**
   * Returns:
   *   - `ICardMatchResult` if the alias resolved to a live catalog entry
   *   - `null` if the alias target is stale (logs warn, caller still returns null)
   *   - `undefined` if no alias row exists (fall through to Stage 2)
   */
  private async tryAliasLookup(
    sourceSlug: string,
    rawName: string,
  ): Promise<ICardMatchResult | null | undefined> {
    const alias = await this.aliasRepo.findOne({
      where: { sourceSlug, rawName },
    });

    if (!alias) {
      return undefined;
    }

    // Validate the alias target still exists in the catalog
    try {
      this.catalogService.getCard(alias.cardIdentifier);
      return { cardIdentifier: alias.cardIdentifier, source: 'alias' };
    } catch (err) {
      if (err instanceof CardNotFoundError) {
        this.logger.warn('Stale alias: target cardIdentifier not in catalog', {
          tag: 'alias-target-missing',
          sourceSlug,
          rawName: sanitizeForLog(rawName),
          staleCardIdentifier: alias.cardIdentifier,
        });
        return null;
      }
      throw err;
    }
  }

  private tryDeterministicMatch(rawName: string): ICardMatchResult | null {
    const candidate = buildCandidateIdentifier(rawName);
    if (candidate === null) {
      return null;
    }

    try {
      this.catalogService.getCard(candidate);
      return { cardIdentifier: candidate, source: 'deterministic' };
    } catch (err) {
      if (err instanceof CardNotFoundError) {
        return null;
      }
      throw err;
    }
  }
}

/**
 * Pure function: derives a candidate `cardIdentifier` from a raw store product
 * name. Returns `null` if the name is empty after stripping.
 *
 * Exported for direct unit testing without NestJS DI setup.
 */
export function buildCandidateIdentifier(rawName: string): string | null {
  let name = rawName.trim();

  // 1. Strip leading quantity prefix (e.g. "5 Copper" -> "Copper")
  name = name.replace(LEADING_QUANTITY_RE, '').trim();

  // 2. Extract pitch color label at the end of the name (before stripping foil
  //    suffixes, because the product may carry both: "Head Jab (Rainbow Foil) (Red)".
  //    The pitch label is always the outermost parenthetical.)
  let pitchSuffix: string | null = null;
  for (const [label, suffix] of Object.entries(PITCH_COLOR_MAP)) {
    if (name.toLowerCase().endsWith(label.toLowerCase())) {
      pitchSuffix = suffix;
      name = name.slice(0, name.length - label.length).trim();
      break;
    }
  }

  // 3. Strip known foil/variant suffixes (case-insensitive, ordered longest-first).
  //    Only one foil suffix is expected per product name.
  for (const suffix of STRIPPABLE_SUFFIXES) {
    const suffixLower = suffix.toLowerCase();
    if (name.toLowerCase().endsWith(suffixLower)) {
      name = name.slice(0, name.length - suffix.length).trim();
      break;
    }
  }

  if (name.length === 0) {
    return null;
  }

  // 4. Apply canonical kebab transform
  const kebab = toKebabCase(name);

  // 5. Append pitch color suffix if present
  return pitchSuffix !== null ? `${kebab}-${pitchSuffix}` : kebab;
}

/**
 * Converts a card display name to its canonical kebab-case identifier format:
 *   1. Lowercase
 *   2. Strip commas, apostrophes, periods, exclamation marks, question marks
 *   3. Replace whitespace runs with single hyphens
 *   4. Collapse consecutive hyphens
 *   5. Trim leading / trailing hyphens
 *
 * Spike-validated against real @flesh-and-blood/cards identifiers:
 *   'A Drop in the Ocean'  -> 'a-drop-in-the-ocean'
 *   "Autumn's Touch"       -> 'autumns-touch'
 *   '10,000 Year Reunion'  -> '10000-year-reunion'
 *   'Argh... Smash!'       -> 'argh-smash'
 *   'Fact-Finding Mission' -> 'fact-finding-mission'
 *
 * Exported for unit testing.
 */
export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[',.!?:]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitizes a raw name before emitting it to structured logs.
 * Truncates to RAW_NAME_MAX_LOG_LENGTH and strips control characters.
 */
function sanitizeForLog(rawName: string): string {
  return rawName
    .slice(0, RAW_NAME_MAX_LOG_LENGTH)
    .replace(CONTROL_CHAR_RE, '');
}
