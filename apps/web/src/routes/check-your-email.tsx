import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/check-your-email')({
  component: CheckYourEmailPage,
});

function CheckYourEmailPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t('auth.checkEmailTitle')}
      subtitle={t('auth.checkEmailSubtitle')}
      tagline={t('auth.checkEmailTagline')}
      footer={<Link to="/sign-in" className={styles.footerLink}>{t('auth.backToSignIn')}</Link>}
    >
      <div className={styles.infoBox}>
        <div className={styles.infoIcon} aria-hidden="true">✉</div>
        <div>
          <p className={styles.infoTitle}>{t('auth.checkEmailToInbox')}</p>
          <p className={styles.infoCopy}>
            {t('auth.checkEmailCopy')}
          </p>
        </div>
      </div>
      <div className={styles.secondaryActions}>
        <Link to="/sign-in" className={styles.ghostBtn}>
          {t('auth.alreadyVerified')}
        </Link>
      </div>
    </AuthLayout>
  );
}
