export interface IVariantJobDto {
  readonly jobId: string;
  readonly deckId: number;
  readonly deckName: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'canceled';
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
}

export interface IVariantJobsResponse {
  readonly jobs: readonly IVariantJobDto[];
  readonly etaSeconds: number;
}
