export const REQUIRED_DECK_COUNT = 3;
export const TOP_N = 10;

export interface IDeckEntry {
  readonly card: string;
  readonly quantity: number;
}

export interface IDeckFile {
  readonly deck: string;
  readonly url: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly mainboard: readonly IDeckEntry[];
}

export interface IPoolFile {
  readonly deck: string;
  readonly hero: string;
  readonly format: string;
  readonly size: number;
  readonly cards: readonly string[];
}

export type TCandidateName = 'gpt-6.1-sol' | 'gemini-3.8-flash' | 'mimo-v2.6-pro' | 'heuristic' | 'cooccurrence';

/** The agreed order in which candidates are tried. */
export const CANDIDATE_ORDER: readonly TCandidateName[] = [
  'gpt-6.1-sol',
  'gemini-3.8-flash',
  'mimo-v2.6-pro',
  'heuristic',
  'cooccurrence',
];

export type TRunStatus = 'ok' | 'failed' | 'untestable';

export interface IRunFile {
  readonly deck: string;
  readonly candidate: TCandidateName;
  readonly status: TRunStatus;
  readonly top10?: readonly string[];
  readonly reasons?: Readonly<Record<string, string>>;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens?: number;
    readonly costUsd?: number;
  };
  readonly stopReason?: string;
  readonly found?: number;
  readonly minimum?: number;
  readonly error?: string;
}
