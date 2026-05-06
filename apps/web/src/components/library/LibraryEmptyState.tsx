import React from 'react';
import { Link } from '@tanstack/react-router';
import styles from './LibraryEmptyState.module.css';

/**
 * LibraryEmptyState — shown when the user owns zero cards.
 *
 * Single, unambiguous CTA → `/add-cards`. The dedicated add-cards page
 * exposes every method side by side; previously this state offered
 * "Manage CSVs" and "Search and add a card" separately, which forced the
 * user to know which method they wanted before they reached the
 * decision surface.
 */
export function LibraryEmptyState(): React.ReactElement {
  return (
    <section className={styles.container} aria-labelledby="library-empty-heading">
      <div className={styles.diamond} aria-hidden="true">
        ◆
      </div>

      <h2 id="library-empty-heading" className={styles.heading}>
        Your library is empty
      </h2>

      <p className={styles.body}>
        Three ways to grow your arsenal — pick whichever fits the moment.
      </p>

      <Link to="/add-cards" className={styles.primaryCta}>
        <span aria-hidden="true">→</span> Add cards
      </Link>
    </section>
  );
}
