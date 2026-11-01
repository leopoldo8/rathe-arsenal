import React from 'react';
import styles from './Rails.module.css';

interface ISettingRowProps {
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly children: React.ReactNode;
}

/** One setting: its label and explanation at the left, its control at the right; stacked on a phone. */
export function SettingRow({ label, description, children }: ISettingRowProps): React.ReactElement {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        {description !== undefined && <div className={styles.rowDescription}>{description}</div>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}
