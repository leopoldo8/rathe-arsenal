import React from 'react';
import { Link } from '@tanstack/react-router';
import { NewDeckOptionIcon, type TNewDeckOptionIcon } from '../decks-new/NewDeckOptionIcon';
import optionStyles from '../decks-new/NewDeckOptions.module.css';
import styles from './AddOptionRow.module.css';

type TWayIn = '/add-cards' | '/add-cards/product' | '/add-cards/csv' | '/add-cards/scan' | '/add-cards/manual';

interface IAddOptionRowProps {
  readonly to: TWayIn;
  readonly icon: TNewDeckOptionIcon;
  readonly title: string;
  /** The large first row of the first-run screen carries one line under its title. */
  readonly hint?: string;
}

/** One way to put cards in: an icon, a title and a chevron, as the add-cards entry and first-run screens draw it. */
export function AddOptionRow({ to, icon, title, hint }: IAddOptionRowProps): React.ReactElement {
  return (
    <Link to={to} className={`${optionStyles.option} ${hint === undefined ? '' : styles.lead}`}>
      <NewDeckOptionIcon name={icon} />
      <span className={styles.text}>
        <span className={optionStyles.title}>{title}</span>
        {hint !== undefined && <span className={styles.hint}>{hint}</span>}
      </span>
      <span className={optionStyles.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
