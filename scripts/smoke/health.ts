import { pollUntil, type IPollOptions } from './poll';

export interface IHealthAnswer {
  readonly status: string;
  readonly commit: string | null;
}

/** True when the deployed SHA is the expected one; a short expected SHA matches by prefix. */
export function commitMatches(deployed: string | null, expected: string): boolean {
  if (deployed === null) return false;
  const a = deployed.toLowerCase();
  const b = expected.toLowerCase();
  return a.startsWith(b) || b.startsWith(a);
}

/** Polls /api/health until `commit` is the expected one. A fetch error is an observation, not a failure, while the deploy restarts. */
export async function waitForCommit(
  readHealth: () => Promise<IHealthAnswer>,
  expected: string,
  options: IPollOptions,
): Promise<void> {
  await pollUntil(async () => {
    try {
      const answer = await readHealth();
      if (commitMatches(answer.commit, expected)) return { done: true, value: undefined };
      return { done: false, note: answer.commit === null ? 'health reports no commit (RAILWAY_GIT_COMMIT_SHA is not set, or the old version is still live)' : `health reports commit ${answer.commit.slice(0, 12)}` };
    } catch (error) {
      return { done: false, note: `health did not answer: ${(error as Error).message}` };
    }
  }, options);
}
