import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitMatches, waitForCommit } from '../health';

const SHA = '49521011b6a0e2d1f1c0b8a7d9e8f7a6b5c4d3e2';
const clock = (): { sleep: (ms: number) => Promise<void>; now: () => number } => {
  let t = 0;
  return { sleep: async (ms) => void (t += ms), now: () => t };
};

describe('commitMatches', () => {
  it('matches the same SHA, in any case, and a short prefix of it', () => {
    assert.equal(commitMatches(SHA, SHA.toUpperCase()), true);
    assert.equal(commitMatches(SHA, '4952101'), true);
  });
  it('does not match another SHA or an unknown commit', () => {
    assert.equal(commitMatches(SHA, 'deadbeef'), false);
    assert.equal(commitMatches(null, SHA), false);
  });
});

describe('waitForCommit', () => {
  it('polls through the old commit and a restart until the new one is live', async () => {
    const answers: Array<() => { status: string; commit: string | null }> = [
      () => ({ status: 'ok', commit: 'old0000000' }),
      () => ({ status: 'ok', commit: null }),
      () => {
        throw new Error('fetch failed');
      },
      () => ({ status: 'ok', commit: SHA }),
    ];
    let i = 0;
    await waitForCommit(async () => answers[i++]!(), SHA, { timeoutMs: 600_000, intervalMs: 10_000, ...clock() });
    assert.equal(i, 4);
  });

  it('fails after the bound, saying what it last saw', async () => {
    await assert.rejects(
      waitForCommit(async () => ({ status: 'ok', commit: 'old0000000abc' }), SHA, { timeoutMs: 60_000, intervalMs: 10_000, ...clock() }),
      /timed out after 60s.*old0000000ab/,
    );
  });

  it('says so when the live version reports no commit at all', async () => {
    await assert.rejects(
      waitForCommit(async () => ({ status: 'ok', commit: null }), SHA, { timeoutMs: 20_000, intervalMs: 10_000, ...clock() }),
      /RAILWAY_GIT_COMMIT_SHA/,
    );
  });
});
