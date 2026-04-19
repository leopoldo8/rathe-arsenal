import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/check-your-email')({
  component: CheckYourEmailPage,
});

function CheckYourEmailPage(): React.ReactElement {
  return (
    <AuthLayout
      title="Check your email"
      subtitle="We've sent you a link. Follow it to continue."
      tagline="The raven has flown."
      footer={<Link to="/sign-in" className={styles.footerLink}>Back to sign in</Link>}
    >
      <div className={styles.infoBox}>
        <div className={styles.infoIcon} aria-hidden="true">✉</div>
        <div>
          <p className={styles.infoTitle}>Sent to your inbox</p>
          <p className={styles.infoCopy}>
            We sent a verification link to your email address. Click it to
            complete sign-up. The link expires in 24 hours. Check your spam
            folder if you don&apos;t see it.
          </p>
        </div>
      </div>
      <div className={styles.secondaryActions}>
        <Link to="/sign-in" className={styles.ghostBtn}>
          Already verified? Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
