import * as crypto from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import { CatalogService } from '../../catalog/catalog.service';
import {
  ICsvParseResult,
  IParsedCsvRow,
  IResolvedCsvRow,
  ISkippedCsvRow,
  TSkipReason,
} from './csv.types';

/**
 * Maximum number of data rows (excluding header) allowed in a single CSV
 * upload. Throws `BadRequestException('CSV_TOO_MANY_ROWS')` when exceeded.
 */
const MAX_CSV_ROWS = 5_000;

/**
 * Column alias maps: each entry is a set of accepted header names (lowercase)
 * that map to a canonical field name. The lookup normalises headers from a
 * variety of export tools (Fabrary, PTCG-style exports, etc.).
 */
const NAME_ALIASES: ReadonlySet<string> = new Set(['name', 'card name']);
const QUANTITY_ALIASES: ReadonlySet<string> = new Set([
  'quantity',
  'qty',
  'count',
]);
const SET_ALIASES: ReadonlySet<string> = new Set(['set', 'set code']);

/**
 * Trailing-pitch-suffix pattern produced by Fabrary and similar exporters,
 * e.g. `"Bare Fangs (red)"`. Capture group 1 is the base name (with trailing
 * whitespace already trimmed by `trim()` upstream), group 2 is the colour.
 *
 * Cards without a pitch value (equipment, weapons, hero) export without the
 * suffix and are not matched here — they fall through to the plain-name path.
 */
const PITCH_SUFFIX_PATTERN = /^(.+?)\s*\((red|yellow|blue)\)$/i;

const PITCH_BY_COLOUR: Record<string, number> = {
  red: 1,
  yellow: 2,
  blue: 3,
};

/**
 * A lazy-initialized, process-scoped name index built from the catalog.
 *
 * Key: lowercase card name.
 * Value: array of cardIdentifiers that share that name (pitch variants produce
 *        separate entries in the catalog but share the base name).
 *
 * This map is built once on first `parse()` call and then reused for all
 * subsequent calls — the catalog is process-immutable so re-building it
 * would be wasteful.
 */
let nameIndex: Map<string, string[]> | null = null;

/**
 * Parses uploaded CSV buffers into resolved and skipped row collections.
 *
 * Design decisions:
 * - Pure function on buffer input — no file I/O, no path traversal risk.
 * - Lazy catalog index built once per process lifetime (catalog is immutable).
 * - Column aliases tolerate a variety of export tool header formats.
 * - Set column used for disambiguation only when a name maps to multiple
 *   pitch variants; the first 3 characters of raw card `setIdentifiers`
 *   entries are compared (case-insensitive) against the provided set value.
 */
@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Parses a CSV buffer and resolves rows to catalog card identifiers.
   *
   * @param buffer - Raw CSV bytes from the multipart upload.
   * @returns `{ resolved, skipped }` — immutable slices.
   * @throws `BadRequestException('INVALID_CSV')` when papaparse reports errors.
   * @throws `BadRequestException('CSV_TOO_MANY_ROWS')` when row count > 5 000.
   */
  parse(buffer: Buffer): ICsvParseResult {
    const csvText = buffer.toString('utf-8');

    const parseResult = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      const message = parseResult.errors
        .map((e) => e.message)
        .join('; ');
      this.logger.warn({ event: 'csv.parse.error', message });
      throw new BadRequestException('INVALID_CSV');
    }

    const rows = parseResult.data;

    if (rows.length > MAX_CSV_ROWS) {
      throw new BadRequestException('CSV_TOO_MANY_ROWS');
    }

    if (rows.length === 0) {
      return { resolved: [], skipped: [] };
    }

    // Build the name index lazily.
    const index = this.getOrBuildNameIndex();

    // noUncheckedIndexedAccess: rows[0] may be undefined even after length check.
    // We know it is not undefined because rows.length > 0.
    const firstRow = rows[0] as Record<string, string>;
    const headers = Object.keys(firstRow).map((h) => h.trim().toLowerCase());

    const nameHeader = this.resolveHeader(headers, NAME_ALIASES, firstRow);
    const quantityHeader = this.resolveHeader(headers, QUANTITY_ALIASES, firstRow);
    const setHeader = this.resolveHeader(headers, SET_ALIASES, firstRow);

    const resolved: IResolvedCsvRow[] = [];
    const skipped: ISkippedCsvRow[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] as Record<string, string>;
      const rowNumber = i + 2; // +1 for 1-based, +1 for header row

      const parsed = this.extractRow(row, rowNumber, nameHeader, quantityHeader, setHeader);
      const result = this.resolveRow(parsed, index);

      if (result.kind === 'resolved') {
        resolved.push(result.row);
      } else {
        skipped.push(result.row);
      }
    }

    this.logger.log({
      event: 'csv.parse.complete',
      resolvedCount: resolved.length,
      skippedCount: skipped.length,
    });

    return { resolved, skipped };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the process-scope name index, building it on first call.
   * The catalog is process-immutable so rebuilding on every parse would waste
   * CPU; we cache the result in module scope.
   */
  private getOrBuildNameIndex(): Map<string, string[]> {
    if (nameIndex !== null) {
      return nameIndex;
    }

    const cards = this.catalogService.getCards();
    const built = new Map<string, string[]>();

    for (const card of cards) {
      const key = card.name.toLowerCase();
      const existing = built.get(key);
      if (existing !== undefined) {
        existing.push(card.cardIdentifier);
      } else {
        built.set(key, [card.cardIdentifier]);
      }
    }

    nameIndex = built;
    this.logger.log({
      event: 'csv.nameIndex.built',
      uniqueNames: built.size,
    });

    return nameIndex;
  }

  /**
   * Finds the actual header string in the row that corresponds to one of the
   * known aliases (case-insensitive match). Returns the matching original-case
   * header key for use as a row accessor.
   *
   * Returns `null` when no alias matches (e.g., the CSV has no set column).
   */
  private resolveHeader(
    lowercaseHeaders: string[],
    aliases: ReadonlySet<string>,
    firstRow: Record<string, string>,
  ): string | null {
    const originalHeaders = Object.keys(firstRow);
    for (let i = 0; i < lowercaseHeaders.length; i += 1) {
      const lowerHeader = lowercaseHeaders[i];
      const originalHeader = originalHeaders[i];
      // Both arrays are built from the same Object.keys() call on firstRow, so
      // indices are guaranteed to be in range; casts satisfy noUncheckedIndexedAccess.
      if (lowerHeader !== undefined && originalHeader !== undefined && aliases.has(lowerHeader)) {
        return originalHeader;
      }
    }
    return null;
  }

  /**
   * Extracts raw field values from a single CSV row using the resolved header
   * keys. Handles missing or undefined cells gracefully.
   */
  private extractRow(
    row: Record<string, string>,
    rowNumber: number,
    nameHeader: string | null,
    quantityHeader: string | null,
    setHeader: string | null,
  ): IParsedCsvRow {
    const name = nameHeader !== null ? (row[nameHeader] ?? '').trim() : '';
    const rawQuantity = quantityHeader !== null ? (row[quantityHeader] ?? '').trim() : '';
    const rawSet = setHeader !== null ? (row[setHeader] ?? '').trim() : undefined;
    const set = rawSet !== undefined && rawSet.length > 0 ? rawSet : undefined;

    // exactOptionalPropertyTypes: only include the `set` key when it has a value.
    if (set !== undefined) {
      return { rowNumber, name, rawQuantity, set };
    }
    return { rowNumber, name, rawQuantity };
  }

  /**
   * Resolves a single parsed row to a catalog card identifier or a skip reason.
   */
  private resolveRow(
    parsed: IParsedCsvRow,
    index: Map<string, string[]>,
  ):
    | { kind: 'resolved'; row: IResolvedCsvRow }
    | { kind: 'skipped'; row: ISkippedCsvRow } {
    const { rowNumber, name, rawQuantity, set } = parsed;

    // --- Guard: empty name ---
    if (name.length === 0) {
      return this.skip(rowNumber, name, 'empty-name');
    }

    // --- Guard: invalid quantity ---
    const quantity = this.parseQuantity(rawQuantity);
    if (quantity === null) {
      return this.skip(rowNumber, name, 'invalid-quantity');
    }

    // --- Pitch suffix path: "Name (red|yellow|blue)" → strip + filter by pitch.
    const pitchMatch = name.match(PITCH_SUFFIX_PATTERN);
    if (pitchMatch !== null) {
      const baseName = pitchMatch[1]!.trim();
      const colour = pitchMatch[2]!.toLowerCase();
      const pitch = PITCH_BY_COLOUR[colour]!;

      const baseCandidates = index.get(baseName.toLowerCase());
      if (baseCandidates === undefined || baseCandidates.length === 0) {
        return this.skip(rowNumber, name, 'no-match');
      }

      const byPitch = baseCandidates.filter(
        (id) => this.catalogService.getCard(id).pitch === pitch,
      );
      if (byPitch.length === 1) {
        return {
          kind: 'resolved',
          row: { rowNumber, cardIdentifier: byPitch[0]!, quantity },
        };
      }
      if (byPitch.length === 0) {
        return this.skip(rowNumber, name, 'no-match');
      }
      // >1 catalog cards share name + pitch (extremely rare, e.g. cross-set
      // reprints with identical pitch); fall through to set-column disambiguator.
      return this.disambiguateOrAmbiguous(byPitch, set, rowNumber, name, quantity);
    }

    // --- Catalog lookup ---
    const candidates = index.get(name.toLowerCase());
    if (candidates === undefined || candidates.length === 0) {
      return this.skip(rowNumber, name, 'no-match');
    }

    if (candidates.length === 1) {
      // noUncheckedIndexedAccess: candidates[0] is guaranteed non-undefined
      // because we just checked candidates.length === 1.
      const cardIdentifier = candidates[0] as string;
      return {
        kind: 'resolved',
        row: { rowNumber, cardIdentifier, quantity },
      };
    }

    return this.disambiguateOrAmbiguous(candidates, set, rowNumber, name, quantity);
  }

  /**
   * Multi-candidate fallback: try the optional set column to narrow down to a
   * single identifier. Returns `ambiguous` when the set column is missing or
   * does not narrow the set to exactly one match. Shared between the
   * pitch-suffix path and the plain-name path.
   */
  private disambiguateOrAmbiguous(
    candidates: string[],
    set: string | undefined,
    rowNumber: number,
    name: string,
    quantity: number,
  ):
    | { kind: 'resolved'; row: IResolvedCsvRow }
    | { kind: 'skipped'; row: ISkippedCsvRow } {
    if (set !== undefined && set.length > 0) {
      const narrowed = this.filterBySet(candidates, set);
      if (narrowed.length === 1) {
        return {
          kind: 'resolved',
          row: { rowNumber, cardIdentifier: narrowed[0] as string, quantity },
        };
      }
    }
    return this.skip(rowNumber, name, 'ambiguous');
  }

  /**
   * Filters candidate card identifiers to those whose raw `setIdentifiers`
   * array contains an entry whose 3-letter prefix matches the set column value
   * (case-insensitive). Falls back to matching against set abbreviation prefix
   * of the identifier itself when getRawCard is unavailable.
   *
   * Note: `setIdentifiers` is not on `ICatalogCard`; we fetch it via
   * `CatalogService.getRawCard()` which returns the untyped raw card object.
   */
  private filterBySet(candidates: string[], setQuery: string): string[] {
    const normalizedSet = setQuery.trim().toLowerCase();

    return candidates.filter((cardIdentifier) => {
      try {
        const raw = this.catalogService.getRawCard(cardIdentifier) as {
          setIdentifiers?: string[];
        };
        const setIds = raw.setIdentifiers ?? [];
        return setIds.some((sid) => {
          // setIdentifiers entries look like "ARC036"; prefix is "ARC".
          const prefix = sid.slice(0, 3).toLowerCase();
          return prefix === normalizedSet || sid.toLowerCase() === normalizedSet;
        });
      } catch {
        return false;
      }
    });
  }

  /**
   * Parses a quantity string to a positive integer. Returns `null` for zero,
   * negative values, non-integers, or empty strings.
   */
  private parseQuantity(raw: string): number | null {
    if (raw.length === 0) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }

  private skip(
    rowNumber: number,
    name: string,
    reason: TSkipReason,
  ): { kind: 'skipped'; row: ISkippedCsvRow } {
    return { kind: 'skipped', row: { rowNumber, name, reason } };
  }
}

/**
 * Computes a deterministic SHA-256 content hash for a resolved row set.
 *
 * The hash is order-independent: rows are sorted by `cardIdentifier` before
 * serialisation, so two parsers over the same logical content (even in
 * different row orders) produce the same hash.
 *
 * Format per line: `${cardIdentifier}:${quantity}\n`
 *
 * This is exported as a pure helper so tests and the upload endpoint can call
 * it without instantiating the service.
 */
export function computeContentHash(resolved: readonly IResolvedCsvRow[]): string {
  const sorted = [...resolved].sort((a, b) =>
    a.cardIdentifier.localeCompare(b.cardIdentifier),
  );

  const serialized = sorted
    .map((r) => `${r.cardIdentifier}:${r.quantity}\n`)
    .join('');

  return crypto.createHash('sha256').update(serialized).digest('hex');
}
