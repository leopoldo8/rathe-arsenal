/**
 * ToastContext — types and context object extracted from `ToastProvider.tsx`
 * so that the provider file remains a component-only module and Fast Refresh
 * works without warnings.
 *
 * Import `ToastContext` here in `useToast.ts` and `ToastProvider.tsx`.
 */

import { createContext, type RefObject } from 'react';

export type TToastKind = 'error' | 'success' | 'info';

export interface IToastPayload {
  readonly kind: TToastKind;
  readonly message: string;
  /** Optional retry callback. Shown as "Retry" button when kind is 'error'. */
  readonly retry?: () => void;
  /** Element to return focus to when toast is dismissed. */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Optional generic action button. Shown alongside the close button.
   * Used for "Undo" patterns (e.g. optimistic untrack with deferred mutation).
   */
  /**
   * Stays on screen until it is dismissed, instead of closing after a few seconds. For a message that
   * carries the only way back from something the player just did.
   */
  readonly persistent?: boolean;
  /** Closes at the player's next action anywhere outside the toast: a tap or a key press. */
  readonly dismissOnNextAction?: boolean;
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
}

export interface IToastContext {
  show: (payload: IToastPayload) => void;
}

export const ToastContext = createContext<IToastContext | null>(null);
