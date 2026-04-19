import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import styles from './placeholder.module.css';

export const Route = createFileRoute('/_auth/reviews')({
  component: ReviewsPage,
});

function ReviewsPage(): React.ReactElement {
  return (
    <div className={styles.container}>
      <div className={styles.badge}>Coming in v1</div>
      <h1 className={styles.heading}>Reviews</h1>
      <p className={styles.copy}>
        Deck review mode with side-by-side card comparison and substitution
        decision log. Lands when the review engine is ready in Plan B.
      </p>
    </div>
  );
}
