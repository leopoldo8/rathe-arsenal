import {
  ISwapLifecycleState,
  resolveSwapTransition,
  TSwapAction,
  TSwapRejectionReason,
  TSwapTransition,
} from '../resolve-swap-transition';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const EARLIER = new Date('2026-09-01T08:00:00.000Z');

function makeState(overrides: Partial<ISwapLifecycleState> = {}): ISwapLifecycleState {
  return {
    status: 'pending',
    appliedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionNote: null,
    outcome: null,
    ...overrides,
  };
}

const APPROVE: TSwapAction = { kind: 'approve' };
const REVERT: TSwapAction = { kind: 'revert' };
const RESTORE: TSwapAction = { kind: 'restore' };

function reject(reason?: TSwapRejectionReason, note?: string): TSwapAction {
  return { kind: 'reject', reason, note };
}

function outcome(value: 'worked' | 'did_not_work'): TSwapAction {
  return { kind: 'outcome', outcome: value };
}

function expectWrite(result: TSwapTransition): Extract<TSwapTransition, { kind: 'write' }> {
  expect(result.kind).toBe('write');
  return result as Extract<TSwapTransition, { kind: 'write' }>;
}

describe('resolveSwapTransition', () => {
  describe('approve', () => {
    it('moves pending to approved, stamps appliedAt and starts with no outcome', () => {
      const result = expectWrite(resolveSwapTransition(makeState(), APPROVE, NOW));

      expect(result.patch).toEqual({ status: 'approved', appliedAt: NOW, outcome: null });
      expect(result.affectsReadiness).toBe(true);
    });

    it('is a no-op on an already approved row and never re-stamps appliedAt', () => {
      const result = resolveSwapTransition(
        makeState({ status: 'approved', appliedAt: EARLIER }),
        APPROVE,
        NOW,
      );

      expect(result).toEqual({ kind: 'noop' });
    });

    it.each(['rejected', 'retired'] as const)('is illegal from %s', (status) => {
      expect(resolveSwapTransition(makeState({ status }), APPROVE, NOW)).toEqual({ kind: 'illegal' });
    });
  });

  describe('reject', () => {
    it('moves pending to rejected with the reason and note', () => {
      const result = expectWrite(
        resolveSwapTransition(makeState(), reject('dont_own', 'sold my copies'), NOW),
      );

      expect(result.patch).toEqual({
        status: 'rejected',
        rejectedAt: NOW,
        rejectionReason: 'dont_own',
        rejectionNote: 'sold my copies',
      });
      expect(result.affectsReadiness).toBe(true);
    });

    it('writes explicit nulls when rejected without a reason or note', () => {
      const result = expectWrite(resolveSwapTransition(makeState(), reject(), NOW));

      expect(result.patch).toEqual({
        status: 'rejected',
        rejectedAt: NOW,
        rejectionReason: null,
        rejectionNote: null,
      });
    });

    it('stores a blank note as null so no empty quote is ever rendered', () => {
      const result = expectWrite(resolveSwapTransition(makeState(), reject('other', '   '), NOW));

      expect(result.patch.rejectionNote).toBeNull();
    });

    it('is a no-op when re-rejected with the same reason and note', () => {
      const state = makeState({
        status: 'rejected',
        rejectedAt: EARLIER,
        rejectionReason: 'not_equivalent',
        rejectionNote: 'too slow',
      });

      expect(resolveSwapTransition(state, reject('not_equivalent', 'too slow'), NOW)).toEqual({ kind: 'noop' });
    });

    it('treats an omitted reason and a stored null reason as the same (no-op)', () => {
      const state = makeState({ status: 'rejected', rejectedAt: EARLIER });

      expect(resolveSwapTransition(state, reject(), NOW)).toEqual({ kind: 'noop' });
    });

    it('updates the reason and re-stamps rejectedAt when re-rejected with a different reason', () => {
      const state = makeState({ status: 'rejected', rejectedAt: EARLIER, rejectionReason: 'dont_own' });

      const result = expectWrite(resolveSwapTransition(state, reject('changes_plan'), NOW));

      expect(result.patch).toEqual({
        status: 'rejected',
        rejectedAt: NOW,
        rejectionReason: 'changes_plan',
        rejectionNote: null,
      });
      expect(result.affectsReadiness).toBe(false);
    });

    it('updates when only the note differs, so an edited note is never swallowed', () => {
      const state = makeState({
        status: 'rejected',
        rejectedAt: EARLIER,
        rejectionReason: 'other',
        rejectionNote: 'first draft',
      });

      const result = expectWrite(resolveSwapTransition(state, reject('other', 'second draft'), NOW));

      expect(result.patch.rejectionNote).toBe('second draft');
    });

    it('clears a stored reason when re-rejected without one', () => {
      const state = makeState({ status: 'rejected', rejectedAt: EARLIER, rejectionReason: 'dont_own' });

      const result = expectWrite(resolveSwapTransition(state, reject(), NOW));

      expect(result.patch.rejectionReason).toBeNull();
    });

    it.each(['approved', 'retired'] as const)('is illegal from %s', (status) => {
      expect(resolveSwapTransition(makeState({ status }), reject('other'), NOW)).toEqual({ kind: 'illegal' });
    });
  });

  describe('revert', () => {
    it('moves approved back to pending and clears appliedAt and outcome', () => {
      const state = makeState({ status: 'approved', appliedAt: EARLIER, outcome: 'worked' });

      const result = expectWrite(resolveSwapTransition(state, REVERT, NOW));

      expect(result.patch).toEqual({ status: 'pending', appliedAt: null, outcome: null });
      expect(result.affectsReadiness).toBe(true);
    });

    it('is a no-op on an already pending row', () => {
      expect(resolveSwapTransition(makeState(), REVERT, NOW)).toEqual({ kind: 'noop' });
    });

    it.each(['rejected', 'retired'] as const)('is illegal from %s', (status) => {
      expect(resolveSwapTransition(makeState({ status }), REVERT, NOW)).toEqual({ kind: 'illegal' });
    });
  });

  describe('restore', () => {
    it('moves rejected back to pending and clears every rejection field', () => {
      const state = makeState({
        status: 'rejected',
        rejectedAt: EARLIER,
        rejectionReason: 'prefer_original',
        rejectionNote: 'want the real one',
      });

      const result = expectWrite(resolveSwapTransition(state, RESTORE, NOW));

      expect(result.patch).toEqual({
        status: 'pending',
        rejectedAt: null,
        rejectionReason: null,
        rejectionNote: null,
      });
      expect(result.affectsReadiness).toBe(true);
    });

    it('is a no-op on an already pending row', () => {
      expect(resolveSwapTransition(makeState(), RESTORE, NOW)).toEqual({ kind: 'noop' });
    });

    it.each(['approved', 'retired'] as const)('is illegal from %s', (status) => {
      expect(resolveSwapTransition(makeState({ status }), RESTORE, NOW)).toEqual({ kind: 'illegal' });
    });
  });

  describe('outcome', () => {
    it('records the outcome on an approved row without touching readiness', () => {
      const state = makeState({ status: 'approved', appliedAt: EARLIER });

      const result = expectWrite(resolveSwapTransition(state, outcome('did_not_work'), NOW));

      expect(result.patch).toEqual({ outcome: 'did_not_work' });
      expect(result.affectsReadiness).toBe(false);
    });

    it('overwrites a different stored outcome', () => {
      const state = makeState({ status: 'approved', appliedAt: EARLIER, outcome: 'worked' });

      const result = expectWrite(resolveSwapTransition(state, outcome('did_not_work'), NOW));

      expect(result.patch).toEqual({ outcome: 'did_not_work' });
    });

    it('is a no-op when re-sending the stored outcome', () => {
      const state = makeState({ status: 'approved', appliedAt: EARLIER, outcome: 'worked' });

      expect(resolveSwapTransition(state, outcome('worked'), NOW)).toEqual({ kind: 'noop' });
    });

    it.each(['pending', 'rejected', 'retired'] as const)('is illegal from %s', (status) => {
      expect(resolveSwapTransition(makeState({ status }), outcome('worked'), NOW)).toEqual({ kind: 'illegal' });
    });
  });
});
