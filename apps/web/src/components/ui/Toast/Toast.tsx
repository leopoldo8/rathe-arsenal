/**
 * Toast — public re-exports.
 *
 * Consumers import from this barrel file:
 *   import { ToastProvider } from '@/components/ui/Toast';
 *
 * The Radix primitives are wired internally in ToastProvider.tsx.
 * `useToast` and its types are importable directly from `./useToast` and
 * `./ToastContext` to keep this barrel component-only.
 */

export { ToastProvider } from './ToastProvider';
export type { IToastPayload, IToastContext, TToastKind } from './ToastContext';
