import React, { useEffect, useRef } from 'react';
import { LibraryFilterRail } from './LibraryFilterRail';
import type { ILibraryFiltersValue } from './LibraryFilterRail';
import type { ILibraryCard } from '../../api/library';
import styles from './LibraryFilterDrawer.module.css';

interface ILibraryFilterDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly cards: readonly ILibraryCard[];
  readonly value: ILibraryFiltersValue;
  readonly onChange: (value: ILibraryFiltersValue) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (next: string) => void;
  readonly matchingCount: number;
  readonly setNames?: Readonly<Record<string, string>>;
}

/**
 * Right-side drawer that hosts `LibraryFilterRail` on viewports below the
 * 1280px breakpoint. Keyboard handling: Escape closes; focus moves to the
 * close button on open and is restored to the trigger on close (the
 * trigger is owned by the parent route via `onClose`). Body scroll is
 * locked while open so the user's tap on the backdrop doesn't scroll the
 * grid behind it.
 */
export function LibraryFilterDrawer({
  open,
  onClose,
  cards,
  value,
  onChange,
  searchQuery,
  onSearchChange,
  matchingCount,
  setNames,
}: ILibraryFilterDrawerProps): React.ReactElement | null {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} data-testid="filter-drawer-backdrop">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Library filters"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Filters</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
        </header>
        <div className={styles.content}>
          <LibraryFilterRail
            cards={cards}
            value={value}
            onChange={onChange}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            matchingCount={matchingCount}
            // exactOptionalPropertyTypes — only forward `setNames` when defined.
            {...(setNames !== undefined ? { setNames } : {})}
            variant="drawer"
          />
        </div>
      </aside>
    </div>
  );
}
