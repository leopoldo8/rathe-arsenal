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
}

export interface IToastContext {
  show: (payload: IToastPayload) => void;
}

export const ToastContext = createContext<IToastContext | null>(null);
