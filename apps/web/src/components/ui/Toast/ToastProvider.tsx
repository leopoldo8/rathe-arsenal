import React, { createContext, useCallback, useRef, useState } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import styles from './Toast.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TToastKind = 'error' | 'success' | 'info';

export interface IToastPayload {
  readonly kind: TToastKind;
  readonly message: string;
  /** Optional retry callback. Shown as "Retry" button when kind is 'error'. */
  readonly retry?: () => void;
  /** Element to return focus to when toast is dismissed. */
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
}

interface IToastItem extends IToastPayload {
  readonly id: string;
}

/** Consolidated burst item — merges N simultaneous error toasts. */
interface IConsolidatedToast {
  readonly kind: 'consolidated';
  readonly count: number;
  readonly retries: ReadonlyArray<() => void>;
  readonly id: string;
}

type TActiveToast = IToastItem | IConsolidatedToast;

export interface IToastContext {
  show: (payload: IToastPayload) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ToastContext = createContext<IToastContext | null>(null);

// ---------------------------------------------------------------------------
// Burst consolidation constants
// ---------------------------------------------------------------------------

const BURST_WINDOW_MS = 500;
const BURST_THRESHOLD = 2;
const TOAST_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface IToastProviderProps {
  readonly children: React.ReactNode;
}

export function ToastProvider({ children }: IToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<TActiveToast[]>([]);

  // Pending errors accumulated during the burst window
  const pendingErrors = useRef<IToastPayload[]>([]);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBurst = useCallback(() => {
    const pending = pendingErrors.current;
    pendingErrors.current = [];
    burstTimerRef.current = null;

    if (pending.length === 0) return;

    if (pending.length < BURST_THRESHOLD) {
      // Below threshold — emit individual toasts
      setToasts((prev) => [
        ...prev,
        ...pending.map((p) => ({ ...p, id: crypto.randomUUID() })),
      ]);
      return;
    }

    // At or above threshold — consolidate into a single burst toast
    const retries = pending.flatMap((p) => (p.retry != null ? [p.retry] : []));
    const consolidated: IConsolidatedToast = {
      kind: 'consolidated',
      count: pending.length,
      retries,
      id: crypto.randomUUID(),
    };
    setToasts((prev) => [...prev, consolidated]);
  }, []);

  const show = useCallback(
    (payload: IToastPayload) => {
      if (payload.kind === 'error') {
        // Buffer errors for burst consolidation
        pendingErrors.current = [...pendingErrors.current, payload];

        if (burstTimerRef.current === null) {
          burstTimerRef.current = setTimeout(flushBurst, BURST_WINDOW_MS);
        }
        return;
      }

      // Non-error toasts are emitted immediately
      setToasts((prev) => [...prev, { ...payload, id: crypto.randomUUID() }]);
    },
    [flushBurst],
  );

  const dismiss = useCallback((id: string, returnFocusRef?: React.RefObject<HTMLElement | null>) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // Guard with isConnected: toast removal triggers a re-render that may
    // unmount the trigger element before focus() executes. Calling focus()
    // on a detached node is a silent no-op in Chrome but throws in some
    // environments. Check isConnected before calling.
    if (returnFocusRef?.current != null && returnFocusRef.current.isConnected) {
      returnFocusRef.current.focus();
    }
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {toasts.map((toast) => {
          if (toast.kind === 'consolidated') {
            return (
              <ConsolidatedToastItem
                key={toast.id}
                toast={toast}
                duration={TOAST_DURATION_MS}
                onDismiss={() => dismiss(toast.id)}
              />
            );
          }
          return (
            <ToastItem
              key={toast.id}
              toast={toast}
              duration={TOAST_DURATION_MS}
              onDismiss={() => dismiss(toast.id, toast.returnFocusRef)}
            />
          );
        })}

        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Individual toast item
// ---------------------------------------------------------------------------

interface IToastItemProps {
  readonly toast: IToastItem;
  readonly duration: number;
  readonly onDismiss: () => void;
}

function ToastItem({ toast, duration, onDismiss }: IToastItemProps): React.ReactElement {
  const kindClass = styles[`toast--${toast.kind}`] ?? '';

  return (
    <RadixToast.Root
      className={`${styles.toast} ${kindClass}`}
      duration={duration}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <div className={styles.toastContent}>
        <RadixToast.Title className={styles.toastTitle} asChild>
          <p>{toast.message}</p>
        </RadixToast.Title>
      </div>

      <div className={styles.toastActions}>
        {toast.kind === 'error' && toast.retry != null && (
          <RadixToast.Action altText="Retry" asChild>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => {
                toast.retry?.();
                onDismiss();
              }}
            >
              Retry
            </button>
          </RadixToast.Action>
        )}
        <RadixToast.Close className={styles.closeButton} aria-label="Dismiss">
          &times;
        </RadixToast.Close>
      </div>
    </RadixToast.Root>
  );
}

// ---------------------------------------------------------------------------
// Consolidated burst toast
// ---------------------------------------------------------------------------

interface IConsolidatedToastItemProps {
  readonly toast: IConsolidatedToast;
  readonly duration: number;
  readonly onDismiss: () => void;
}

function ConsolidatedToastItem({
  toast,
  duration,
  onDismiss,
}: IConsolidatedToastItemProps): React.ReactElement {
  return (
    <RadixToast.Root
      className={`${styles.toast} ${styles['toast--error']}`}
      duration={duration}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <div className={styles.toastContent}>
        <RadixToast.Title className={styles.toastTitle} asChild>
          <p>{toast.count} changes failed</p>
        </RadixToast.Title>
      </div>

      <div className={styles.toastActions}>
        {toast.retries.length > 0 && (
          <RadixToast.Action altText="Retry all" asChild>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => {
                toast.retries.forEach((retry) => retry());
                onDismiss();
              }}
            >
              Retry all
            </button>
          </RadixToast.Action>
        )}
        <RadixToast.Close className={styles.closeButton} aria-label="Dismiss">
          &times;
        </RadixToast.Close>
      </div>
    </RadixToast.Root>
  );
}
