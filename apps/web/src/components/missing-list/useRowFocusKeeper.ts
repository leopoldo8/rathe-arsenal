import { useCallback, useEffect, useRef } from 'react';

const ROW_SELECTOR = '[data-testid="missing-row"]';
const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface IRememberedFocus {
  readonly element: HTMLElement;
  readonly index: number;
}

interface IRowFocusKeeper {
  /** Notes which row holds the focus, so a row that disappears can hand the focus on. */
  readonly remember: (element: HTMLElement) => void;
  /** Where focus should go now that the remembered row is gone: the row that took its place, else the heading. */
  readonly fallbackTarget: () => HTMLElement | null;
}

/**
 * Keeps the keyboard focus on the page when the row that holds it leaves the list, for instance when
 * "Usar" gives a card a stand-in. The browser would drop the focus on the body; this moves it to the row
 * that now sits where the old one was (the last row when it was the last), or to the list heading when no
 * row is left.
 */
export function useRowFocusKeeper(root: HTMLElement | null): IRowFocusKeeper {
  const last = useRef<IRememberedFocus | null>(null);

  const remember = useCallback(
    (element: HTMLElement): void => {
      const row = element.closest(ROW_SELECTOR);
      const rows = root === null ? [] : Array.from(root.querySelectorAll(ROW_SELECTOR));
      last.current = row === null ? null : { element, index: rows.indexOf(row) };
    },
    [root],
  );

  const targetFor = useCallback(
    (remembered: IRememberedFocus | null): HTMLElement | null => {
      if (root === null) return null;
      const heading = root.querySelector<HTMLElement>('h1');
      const rows = Array.from(root.querySelectorAll<HTMLElement>(ROW_SELECTOR));
      if (remembered === null || rows.length === 0) return heading;
      const row = rows[Math.min(remembered.index, rows.length - 1)];
      return row?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? heading;
    },
    [root],
  );

  const fallbackTarget = useCallback((): HTMLElement | null => targetFor(last.current), [targetFor]);

  useEffect(() => {
    if (root === null) return undefined;
    const onFocusIn = (event: FocusEvent): void => {
      if (event.target instanceof HTMLElement) remember(event.target);
    };
    // A row that held the focus was removed while the focus sat on the body: hand it on.
    const observer = new MutationObserver(() => {
      const remembered = last.current;
      if (remembered === null || remembered.element.isConnected) return;
      if (document.activeElement !== null && document.activeElement !== document.body) return;
      last.current = null;
      targetFor(remembered)?.focus();
    });
    root.addEventListener('focusin', onFocusIn);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      observer.disconnect();
    };
  }, [root, remember, targetFor]);

  return { remember, fallbackTarget };
}
