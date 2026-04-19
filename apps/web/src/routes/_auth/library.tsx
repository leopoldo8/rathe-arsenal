import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import styles from './placeholder.module.css';

export const Route = createFileRoute('/_auth/library')({
  component: LibraryPage,
});

function LibraryPage(): React.ReactElement {
  return (
    <div className={styles.container}>
      <div className={styles.badge}>Coming in v1</div>
      <h1 className={styles.heading}>Library</h1>
      <p className={styles.copy}>
        Browse your full card collection, filter by set, and see which cards
        are ready to play. Full library management lands in Plan B.
      </p>
    </div>
  );
}
