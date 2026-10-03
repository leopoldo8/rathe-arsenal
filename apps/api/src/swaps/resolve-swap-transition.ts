export const SWAP_REJECTION_REASONS = [
  'not_equivalent',
  'dont_own',
  'changes_plan',
  'prefer_original',
  'other',
] as const;

export const SWAP_OUTCOMES = ['worked', 'did_not_work'] as const;

export type TSwapRejectionReason = (typeof SWAP_REJECTION_REASONS)[number];
export type TSwapOutcome = (typeof SWAP_OUTCOMES)[number];
export type TSwapStatus = 'pending' | 'approved' | 'rejected' | 'retired';

export interface ISwapLifecycleState {
  readonly status: TSwapStatus;
  readonly appliedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly rejectionReason: TSwapRejectionReason | null;
  readonly rejectionNote: string | null;
  readonly outcome: TSwapOutcome | null;
}

export type TSwapAction =
  | { readonly kind: 'approve' }
  | { readonly kind: 'reject'; readonly reason?: TSwapRejectionReason | undefined; readonly note?: string | undefined }
  | { readonly kind: 'revert' }
  | { readonly kind: 'restore' }
  | { readonly kind: 'outcome'; readonly outcome: TSwapOutcome };

export type TSwapTransition =
  | {
      readonly kind: 'write';
      readonly patch: Partial<ISwapLifecycleState>;
      readonly affectsReadiness: boolean;
    }
  | { readonly kind: 'noop' }
  | { readonly kind: 'illegal' };

const NOOP: TSwapTransition = { kind: 'noop' };
const ILLEGAL: TSwapTransition = { kind: 'illegal' };

function write(patch: Partial<ISwapLifecycleState>, affectsReadiness: boolean): TSwapTransition {
  return { kind: 'write', patch, affectsReadiness };
}

function resolveApprove(state: ISwapLifecycleState, now: Date): TSwapTransition {
  if (state.status === 'approved') return NOOP;
  if (state.status !== 'pending') return ILLEGAL;
  return write({ status: 'approved', appliedAt: now, outcome: null }, true);
}

function resolveReject(
  state: ISwapLifecycleState,
  action: Extract<TSwapAction, { kind: 'reject' }>,
  now: Date,
): TSwapTransition {
  if (state.status !== 'pending' && state.status !== 'rejected') return ILLEGAL;

  const rejectionReason = action.reason ?? null;
  const rejectionNote = action.note?.trim() || null;
  const isRepeat = state.status === 'rejected';

  if (isRepeat && state.rejectionReason === rejectionReason && state.rejectionNote === rejectionNote) {
    return NOOP;
  }

  return write({ status: 'rejected', rejectedAt: now, rejectionReason, rejectionNote }, !isRepeat);
}

function resolveRevert(state: ISwapLifecycleState): TSwapTransition {
  if (state.status === 'pending') return NOOP;
  if (state.status !== 'approved') return ILLEGAL;
  return write({ status: 'pending', appliedAt: null, outcome: null }, true);
}

function resolveRestore(state: ISwapLifecycleState): TSwapTransition {
  if (state.status === 'pending') return NOOP;
  if (state.status !== 'rejected') return ILLEGAL;
  return write(
    { status: 'pending', rejectedAt: null, rejectionReason: null, rejectionNote: null },
    true,
  );
}

function resolveOutcome(state: ISwapLifecycleState, outcome: TSwapOutcome): TSwapTransition {
  if (state.status !== 'approved') return ILLEGAL;
  if (state.outcome === outcome) return NOOP;
  return write({ outcome }, false);
}

/** Implements the state-machine table in design/07-swaps.md §6. */
export function resolveSwapTransition(
  state: ISwapLifecycleState,
  action: TSwapAction,
  now: Date,
): TSwapTransition {
  switch (action.kind) {
    case 'approve':
      return resolveApprove(state, now);
    case 'reject':
      return resolveReject(state, action, now);
    case 'revert':
      return resolveRevert(state);
    case 'restore':
      return resolveRestore(state);
    case 'outcome':
      return resolveOutcome(state, action.outcome);
  }
}
