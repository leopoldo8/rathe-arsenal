import type { TSpareRule } from '../../../database/entities/user.entity';
import type { ICopyVersion } from '../../versions/copy-version';
import type { IDeckUse, INonHoldingDeck, TSpareCounts } from '../spare-copies';

/** One card and version with spare copies, and what the "Sobrando" page draws next to it. */
export interface ISpareRowView extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly spare: number;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  /** The small card image address; null when the card has none. */
  readonly imageUrl: string | null;
  /** The printing's set name, when the version names a printing code the catalog knows. */
  readonly setName: string | null;
  /** The foil finishes this version could be: the named printing's, or, with no printing named, the card's; empty when none. */
  readonly foilFinishes: readonly string[];
  /** TCGplayer in dollars times the multiplier, in reais as cents; null when no printing is priced. */
  readonly suggestedCents: number | null;
  /** The cheapest in-stock store price of the card, in cents; null when the store has none. */
  readonly storeCents: number | null;
}

export interface ISpareWhyView {
  readonly owned: number;
  readonly held: number;
  readonly spare: number;
  readonly holders: readonly IDeckUse[];
  readonly notHolding: readonly INonHoldingDeck[];
}

export interface IIdeaDeckView {
  readonly deckId: number;
  readonly deckName: string;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  /** The most copies the Ideia deck uses of one card the player owns spare. */
  readonly use: number;
}

export interface ISpareResponse {
  readonly needsRule: boolean;
  readonly rule: TSpareRule | null;
  readonly counts: TSpareCounts;
  readonly totalSpare: number;
  readonly rows: readonly ISpareRowView[];
  readonly why: Readonly<Record<string, ISpareWhyView>>;
  readonly ideaDecks: readonly IIdeaDeckView[];
}
