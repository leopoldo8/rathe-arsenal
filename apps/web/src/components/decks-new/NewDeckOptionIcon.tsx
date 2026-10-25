import React from 'react';
import styles from './NewDeckOptions.module.css';

export type TNewDeckOptionIcon = 'box' | 'link' | 'type';

const PATHS: Readonly<Record<TNewDeckOptionIcon, React.ReactElement>> = {
  box: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  type: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
};

export function NewDeckOptionIcon({ name }: { readonly name: TNewDeckOptionIcon }): React.ReactElement {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[name]}
      </svg>
    </span>
  );
}
