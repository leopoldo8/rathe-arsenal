import { describe, it, expect } from 'vitest';
import { hasActiveJobs } from '../variant-jobs';

describe('hasActiveJobs', () => {
  it('is true when any job is pending or running', () => {
    expect(hasActiveJobs({ jobs: [{ status: 'running' } as never], etaSeconds: 5 })).toBe(true);
  });
  it('is false when all jobs are done/failed', () => {
    expect(hasActiveJobs({ jobs: [{ status: 'done' } as never], etaSeconds: 0 })).toBe(false);
  });
  it('is false when there are no jobs', () => {
    expect(hasActiveJobs({ jobs: [], etaSeconds: 0 })).toBe(false);
  });
});
