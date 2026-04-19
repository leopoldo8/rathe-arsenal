import { useContext } from 'react';
import { ToastContext, type IToastContext } from './ToastProvider';

/**
 * Access the toast notification API from any component within <ToastProvider>.
 *
 * Usage:
 *   const { show } = useToast();
 *   show({ kind: 'error', message: 'Save failed', retry: () => save() });
 */
export function useToast(): IToastContext {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}
