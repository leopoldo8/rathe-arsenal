import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ligaFabUrl } from '../../lib/ligafab-link';
import styles from './SpareRowMenu.module.css';

interface ISpareRowMenuProps {
  /** The card's display name: it is part of the button's accessible name. */
  readonly name: string;
  /** The card's plain name, which the LigaFAB search takes. */
  readonly cardName: string;
  readonly onWhy: () => void;
}

/** The "more actions" button at the end of a spare row, and the menu it opens. */
export function SpareRowMenu({ name, cardName, onWhy }: ISpareRowMenuProps): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = (): HTMLElement[] => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function close(returnFocus: boolean): void {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    function handleOutside(event: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handleMenuKey(event: React.KeyboardEvent): void {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number): void => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  }

  return (
    <span className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={t('spare.rowActions', { name })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) close(true);
        }}
      >
        <span aria-hidden="true">&middot;&middot;&middot;</span>
      </button>
      {open && (
        <div id={menuId} ref={menuRef} className={styles.menu} role="menu" aria-label={t('spare.rowActions', { name })} onKeyDown={handleMenuKey}>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onWhy();
            }}
          >
            {t('spare.whySpare')}
          </button>
          <a
            role="menuitem"
            className={styles.item}
            href={ligaFabUrl(cardName)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            {t('spare.ligaFab')}
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      )}
    </span>
  );
}
