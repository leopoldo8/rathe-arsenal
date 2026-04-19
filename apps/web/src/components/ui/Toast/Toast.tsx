/**
 * Toast — public re-exports.
 *
 * Consumers import from this barrel file:
 *   import { useToast, ToastProvider } from '@/components/ui/Toast';
 *
 * The Radix primitives are wired internally in ToastProvider.tsx.
 */

export { ToastProvider } from './ToastProvider';
export type { IToastPayload, IToastContext, TToastKind } from './ToastProvider';
export { useToast } from './useToast';
