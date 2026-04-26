import { IsString, IsUrl } from 'class-validator';
import { IShoppingLineResponse } from '../../../stores/dtos/shopping-line.response.dto';

/**
 * Request body for `POST /api/decks/test`.
 *
 * The test endpoint accepts a single Fabrary deck URL and returns a
 * computed readiness result **without persisting anything**. Validation
 * rejects non-URLs and non-string payloads with 400.
 */
export class TestDeckRequestDto {
  @IsString()
  @IsUrl()
  url!: string;
}

/**
 * Response payload for `POST /api/decks/test`.
 *
 * Mirrors the shape the deck detail page consumes so the frontend result
 * screen can reuse existing presentational components. `alreadyTracked`
 * branches the UI between the two "Track" CTAs and an "already tracked"
 * callout. No snapshot id or persisted metadata is returned -- nothing
 * is written to the database.
 */
export interface ITestDeckBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
  /** U11: Card pitch (1=red, 2=yellow, 3=blue); null for pitch-less cards. */
  readonly pitch: 1 | 2 | 3 | null;
  /** U11: Card cost in resources; null for pitch-less cards. */
  readonly cost: number | null;
  /** U11: Primary card type from catalog. 'unknown' as defensive fallback. */
  readonly type: string;
  /** LSS S3 card face image URLs (small + large). null when unavailable. */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ITestDeckSubstituteCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly classes: readonly string[];
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly keywords: readonly string[];
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ITestDeckSubstitutionMatch {
  readonly substitute: ITestDeckSubstituteCard;
  readonly tier: number;
  readonly score: number;
  readonly rationale: string;
}

export interface ITestDeckSubstitutedEntry {
  readonly original: ITestDeckBreakdownEntry;
  readonly match: ITestDeckSubstitutionMatch;
}

export interface ITestDeckBreakdown {
  readonly exact: readonly ITestDeckBreakdownEntry[];
  readonly substituted: readonly ITestDeckSubstitutedEntry[];
  readonly missing: readonly ITestDeckBreakdownEntry[];
}

export type TTestDeckPath = 'A' | 'B' | 'C';

export interface ITestDeckResponse {
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly totalCards: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TTestDeckPath;
  readonly fidelityPercent: number;
  readonly breakdown: ITestDeckBreakdown;
  readonly alreadyTracked: boolean;
  /**
   * Populated only when `alreadyTracked === true`. Lets the frontend
   * deep-link to the existing tracked deck detail page instead of
   * offering the track CTAs.
   */
  readonly trackedDeckId: number | null;
  /**
   * Shopping line derived at read time from the test deck's breakdown.
   * null = Path A (no missing cards). The discriminated union covers
   * populated / unscraped / error states.
   *
   * Unit 5 (Phase 1b).
   */
  readonly shoppingLine: IShoppingLineResponse | null;
}
