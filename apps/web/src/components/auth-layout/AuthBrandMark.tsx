import React from 'react';
import styles from './AuthBrandMark.module.css';

export function AuthBrandMark(): React.ReactElement {
  return (
    <div className={styles.brand} aria-hidden="true" data-testid="auth-brand-mark">
      <img className={styles.seal} src="/favicon.svg" width={30} height={30} alt="" />
      <span className={styles.wordmark}>Rathe Arsenal</span>
    </div>
  );
}
