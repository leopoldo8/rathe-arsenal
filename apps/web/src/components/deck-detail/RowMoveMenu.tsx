import React from 'react';
import styles from './RowMoveMenu.module.css';

export interface IMoveChoice {
  readonly label: string;
  /** How many copies the choice moves. */
  readonly count: number;
}

interface IRowMoveMenuProps {
  /** The accessible name of the button that opens the menu. */
  readonly label: string;
  readonly testId: string;
  readonly choices: readonly IMoveChoice[];
  readonly onPick: (count: number) => void;
  /** The quantity the button shows: tapping the number is what opens the menu. */
  readonly children: React.ReactNode;
}

/**
 * The quantity of one side of a deck line as a button: tapped, it offers to move one copy or all of
 * them to the other side. It stays a plain number while the side holds no copy to move.
 */
export function RowMoveMenu({ label, testId, choices, onPick, children }: IRowMoveMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <span className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onPick(choice.count);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
