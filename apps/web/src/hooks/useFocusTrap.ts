/**
 * useFocusTrap — confine Tab/Shift+Tab within a container and restore focus
 * to the opener element on deactivation.
 *
 * Used by custom dialogs (CardLightbox, VariantQueueDrawer, LibraryFilterDrawer)
 * that declare `aria-modal` but do not use a Radix primitive (which would trap
 * focus automatically). UXUI-03.
 *
 * Why a custom hook instead of a library:
 *  - No new dependency — the three dialogs have simple focusable sets.
 *  - Mirrors the existing manual focus code already present in those components.
 */
import { type RefObject, useEffect, useRef } from 'react';

/**
 * CSS selector for all elements that can receive keyboard focus.
 * Mirrors the focusable-selector convention used across the three dialog
 * components this hook will be applied to (T7).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface IUseFocusTrapOptions {
  /** If provided, this element receives initial focus when the trap activates. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * When true (default), focus returns to the opener element on deactivation
   * or unmount.
   */
  restoreFocus?: boolean;
}

/**
 * Traps focus within `containerRef` while `active` is true.
 *
 * Behaviour:
 *  - On activate: records `document.activeElement` as the opener; moves focus
 *    to `opts.initialFocusRef` (if supplied) or the first focusable element.
 *  - On Tab at the last focusable: cycles to first.
 *  - On Shift+Tab at the first focusable: cycles to last.
 *  - On deactivate (or unmount): restores focus to the recorded opener.
 *  - When inactive: no-op; the keydown listener is not registered.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  opts?: IUseFocusTrapOptions,
): void {
  const openerRef = useRef<HTMLElement | null>(null);

  const restoreFocus = opts?.restoreFocus ?? true;
  const initialFocusRef = opts?.initialFocusRef;

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Record the element that currently holds focus so we can restore it later.
    openerRef.current = document.activeElement as HTMLElement;

    // Shift focus to the designated initial element or first focusable.
    const initialTarget = initialFocusRef?.current ?? getFocusables()[0] ?? null;
    initialTarget?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab at first element → cycle to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab at last element → cycle to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Listen on the container so only events from inside the trap are caught.
    // keydown bubbles from focused child elements up to the container.
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (
        restoreFocus &&
        openerRef.current &&
        document.contains(openerRef.current)
      ) {
        openerRef.current.focus();
      }
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);
}
