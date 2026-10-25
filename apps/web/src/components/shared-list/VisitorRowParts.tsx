import React from 'react';
import type { ISharedListLine } from '../../api/shared-lists';
import styles from './VisitorList.module.css';

export function Thumb({ line, label }: { readonly line: ISharedListLine; readonly label: string }): React.ReactElement {
  const src = line.imageUrl?.small ?? null;
  return src === null ? (
    <span className={styles.thumbPlaceholder} role="img" aria-label={label} />
  ) : (
    <img className={styles.thumb} src={src} alt={label} loading="lazy" />
  );
}

interface IRowStepperProps {
  readonly value: number;
  readonly max: number;
  readonly increaseLabel: string;
  readonly decreaseLabel: string;
  readonly onChange: (value: number) => void;
}

/** "−  2  +": copies chosen, from 0 to what the row allows. */
export function RowStepper({ value, max, increaseLabel, decreaseLabel, onChange }: IRowStepperProps): React.ReactElement {
  return (
    <span className={styles.stepper}>
      <button type="button" aria-label={decreaseLabel} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        <span aria-hidden="true">&minus;</span>
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <span aria-hidden="true">+</span>
      </button>
    </span>
  );
}
