export interface ITrackedDeckListItem {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly latestSnapshot: {
    readonly rawPercent: number;
    readonly effectivePercent: number;
    readonly computedAt: string;
  } | null;
}

export type TTrackedDeckListResponse = readonly ITrackedDeckListItem[];
