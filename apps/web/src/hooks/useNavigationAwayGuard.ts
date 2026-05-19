/**
 * useNavigationAwayGuard — intercepts TanStack Router navigation and
 * browser tab close when the user has unsaved composition draft changes.
 *
 * Uses TanStack Router's `useBlocker` hook (NOT router.subscribe) to
 * intercept in-app navigation, and `window.addEventListener('beforeunload')`
 * to cover tab close / browser refresh.
 *
 * When the blocker fires:
 *  - Opens DiscardChangesConfirm (via the onBlock callback).
 *  - Resolves the blocker based on the user's choice:
 *    - "Discard changes" → proceed (blockerFn returns false = allow nav).
 *    - "Keep editing" → cancel (blockerFn returns true = block nav).
 *
 * Condition: `isDirty && isEditMode`. Status dropdown, name, and tag mutations
 * do NOT affect isDirty (they are not part of the composition draft per R18a),
 * so they cannot trigger this guard.
 *
 * Two-tab race: documented in the plan (U13). No mitigation in v2.
 */
import { useEffect, useRef } from 'react';
import { useBlocker } from '@tanstack/react-router';

interface INavigationAwayGuardOptions {
  /** True when the composition draft has unsaved changes. */
  readonly isDirty: boolean;
  /** True when the page is in edit mode (edit === '1'). */
  readonly isEditMode: boolean;
  /**
   * Called when blocked navigation is detected.
   * The caller mounts DiscardChangesConfirm and resolves via `proceed`/`stay`.
   */
  readonly onBlock: (proceed: () => void, stay: () => void) => void;
}

/**
 * useNavigationAwayGuard — installs TanStack Router's `useBlocker` +
 * browser `beforeunload` guard to protect unsaved composition draft state.
 */
export function useNavigationAwayGuard({
  isDirty,
  isEditMode,
  onBlock,
}: INavigationAwayGuardOptions): void {
  const shouldBlock = isDirty && isEditMode;

  // Stable ref to onBlock so the blocker closure doesn't stale-close over it.
  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  // TanStack Router `useBlocker` — intercepts in-app navigation.
  // blockerFn returns a Promise<boolean>: true = block, false = allow.
  useBlocker({
    condition: shouldBlock,
    blockerFn: (): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        // proceed() → allow navigation (return false = don't block)
        // stay()    → cancel navigation (return true = block)
        onBlockRef.current(
          () => resolve(false),
          () => resolve(true),
        );
      }),
  });

  // Browser `beforeunload` — covers tab close / page refresh.
  // The browser shows its native prompt (cannot be themed).
  useEffect(() => {
    if (!shouldBlock) return;
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
      e.preventDefault();
      // Modern browsers require returnValue to be set to trigger the prompt.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlock]);
}
