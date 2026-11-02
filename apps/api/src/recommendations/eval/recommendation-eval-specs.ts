import { TSupportedFormat } from '@rathe-arsenal/engine';

/** Where the reference decks of a scenario come from on Fabrary's public deck index. */
export type TReferenceSource = 'tournament' | 'community';

/**
 * The deck the model is asked to improve.
 * `deck`: a fixed list, for a real deck whose recommendation went wrong.
 * `ablation`: the best placed reference deck with its `remove` most played staples taken out; the model should put them back.
 */
export type TEvalInput =
  | { readonly kind: 'deck'; readonly provenance: string; readonly cards: string }
  | { readonly kind: 'ablation'; readonly remove: number };

export interface IReferenceSelection {
  readonly source: TReferenceSource;
  /** Older decks are left out: they were built for a card pool or ban list that no longer holds. */
  readonly maxAgeDays: number;
  /** The most recent decks kept, so one hero's snapshot stays small. */
  readonly maxDecks: number;
}

export interface IEvalSpec {
  readonly id: string;
  readonly heroIdentifier: string;
  readonly format: TSupportedFormat;
  readonly reference: IReferenceSelection;
  readonly input: TEvalInput;
}

const RECENT_TOURNAMENTS: IReferenceSelection = { source: 'tournament', maxAgeDays: 180, maxDecks: 40 };
const ABLATION_REMOVED = 3;

/**
 * Scenarios of the recommendation quality eval. Expected cards are never listed here: the scenario builder derives them
 * from how often the reference decks play each card (`recommendation-eval-scenarios.ts`).
 */
export const EVAL_SPECS: readonly IEvalSpec[] = [
  {
    id: 'kayo-ll-owner-deck',
    heroIdentifier: 'kayo-armed-and-dangerous',
    format: 'Living Legend',
    // Fabrary lists no Kayo Living Legend tournament deck, only player decks. Living Legend changes slowly and Kayo's
    // staples are older than the window, so three years keeps every public list.
    reference: { source: 'community', maxAgeDays: 1095, maxDecks: 40 },
    input: {
      kind: 'deck',
      provenance: 'Owner deck 21 on staging, "[CC/CURRENT] Kayo" converted to Living Legend, read on 2026-11-02',
      cards:
        'beaten-trackers:1 hide-tanner:1 savage-sash:1 scowling-flesh-bag:1 agile-windup-blue:3 agile-windup-yellow:3 assault-and-battery-blue:3 ' +
        'bare-fangs-red:3 bare-fangs-yellow:3 beast-within-yellow:3 bloodrush-bellow-yellow:3 clash-of-agility-red:3 command-and-conquer-red:1 ' +
        'enlightened-strike-red:2 erase-face-red:1 mighty-windup-blue:3 pack-hunt-red:3 pulping-red:3 reckless-swing-blue:1 riled-up-blue:3 ' +
        'run-roughshod-blue:3 savage-feast-red:3 send-packing-yellow:3 smash-instinct-blue:3 wild-ride-red:3 wild-ride-yellow:3 wrecker-romp-blue:2 ' +
        'mandible-claw:1',
    },
  },
  {
    id: 'oscilio-cc-ablation',
    heroIdentifier: 'oscilio-constella-intelligence',
    format: 'Classic Constructed',
    reference: RECENT_TOURNAMENTS,
    input: { kind: 'ablation', remove: ABLATION_REMOVED },
  },
  {
    id: 'cindra-cc-ablation',
    heroIdentifier: 'cindra-dracai-of-retribution',
    format: 'Classic Constructed',
    reference: RECENT_TOURNAMENTS,
    input: { kind: 'ablation', remove: ABLATION_REMOVED },
  },
  {
    id: 'arakni-cc-ablation',
    heroIdentifier: 'arakni-marionette',
    format: 'Classic Constructed',
    reference: RECENT_TOURNAMENTS,
    input: { kind: 'ablation', remove: ABLATION_REMOVED },
  },
  {
    id: 'ira-sa-ablation',
    heroIdentifier: 'ira-crimson-haze',
    format: 'Silver Age',
    reference: RECENT_TOURNAMENTS,
    input: { kind: 'ablation', remove: ABLATION_REMOVED },
  },
];
