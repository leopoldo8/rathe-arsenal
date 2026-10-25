import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { DeleteAccountModal } from '../../components/delete-account-modal';
import { ThemeToggle } from '../../components/shell/ThemeToggle';
import { AccountSetting } from '../../components/settings/AccountSetting';
import { ContactSetting } from '../../components/settings/ContactSetting';
import { DisplayNameSetting } from '../../components/settings/DisplayNameSetting';
import { SpareRuleSetting } from '../../components/settings/SpareRuleSetting';
import { LanguageToggle } from '../../components/shell/LanguageToggle';
import { useTranslation } from 'react-i18next';
import { useCreditsQuery, useTriggerUrlSyncMutation, useUrlSyncStatusQuery } from '../../api/store-admin';
import styles from './settings.module.css';

function CreditsLine() {
  const { t } = useTranslation();
  const { data: credits } = useCreditsQuery();
  if (!credits) return null;
  const { creditsUsed, budget, lookupsStopped } = credits;
  const percentUsed = budget > 0 ? Math.min(100, Math.round((creditsUsed / budget) * 100)) : 100;
  const numbers = { used: creditsUsed, budget };
  return (
    <div className={styles.credits} data-testid="store-credits">
      <div className={styles.creditsHead}>
        <span>{t('settings.creditsLabel')}</span>
        <b className={styles.creditsNumbers}>{t('settings.creditsOf', numbers)}</b>
      </div>
      <div
        className={lookupsStopped ? `${styles.meter} ${styles.meterStopped}` : styles.meter}
        role="img"
        aria-label={t('settings.creditsMeterLabel', numbers)}
      >
        <svg className={styles.meterSvg} aria-hidden="true">
          <rect className={styles.meterFill} width={`${percentUsed}%`} height="100%" />
        </svg>
      </div>
      {lookupsStopped && (
        <p className={styles.stopLine} data-testid="store-credits-stopped">
          {t('settings.lookupsStopped')}
          <span className={styles.stopLineNote}>{t('settings.manualSyncStillWorks')}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Admin-only control to trigger the store catalog URL-sync (productUrl + name
 * discovery via Firecrawl). Rendered only for `role === 'admin'`, so its
 * admin-gated API calls never fire for regular users.
 */
function StoreSyncAdminSection() {
  const { t } = useTranslation();
  const { data: status } = useUrlSyncStatusQuery();
  const trigger = useTriggerUrlSyncMutation();
  const busy = status?.state === 'queued' || status?.state === 'running' || trigger.isPending;

  const statusLine = (() => {
    if (status?.state === 'running') return t('settings.syncingCatalog');
    if (status?.state === 'queued') return t('settings.syncQueued');
    if (status?.lastUrlSyncAt) {
      const when = new Date(status.lastUrlSyncAt).toLocaleString();
      return t('settings.lastSync', { count: status.lastProductCount ?? 0, when });
    }
    return t('settings.neverSynced');
  })();

  const lastFailure = !busy && status?.lastError ? status.lastError : null;

  return (
    <section className={styles.section} aria-labelledby="section-store-sync">
      <h2 id="section-store-sync" className={styles.sectionHeading}>
        {t('settings.storeCatalogSync')}
      </h2>
      <p className={styles.dangerCopy}>{t('settings.syncCatalogDesc')}</p>
      <div className={styles.syncRow}>
        <button
          type="button"
          className={styles.syncBtn}
          disabled={busy}
          onClick={() => trigger.mutate()}
          data-testid="store-sync-trigger"
        >
          {busy ? t('settings.syncInProgress') : t('settings.syncStoreCatalog')}
        </button>
        <span className={styles.syncStatus} data-testid="store-sync-status">{statusLine}</span>
      </div>
      {lastFailure && (
        <p className={styles.syncError} data-testid="store-sync-failure">
          {t('settings.lastSyncFailed', {
            when: new Date(lastFailure.at).toLocaleString(),
            reason: lastFailure.message,
          })}
        </p>
      )}
      {trigger.isError && (
        <p className={styles.syncError}>{t('settings.couldNotQueueSync')}</p>
      )}
      <CreditsLine />
    </section>
  );
}

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage,
});

/**
 * Unit 7 (Onda 3) — Settings page restyled with 3-section layout.
 *
 * Sections:
 *  1. Profile  — email displayed read-only, plus the display name shown on shared decks
 *  2. Theme    — ThemeToggle (client-side; backend persistence wires in Unit 12)
 *  3. Account  — change-password link + delete-account trigger
 *
 * Zero inline styles — all layout is handled by settings.module.css.
 */
export function SettingsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageHeading}>{t('settings.accountSettings')}</h1>

      {/* ---- Section: Account (e-mail and password) ---- */}
      <AccountSetting className={styles.section} />

      {/* ---- Section 1: Profile ---- */}
      <section className={styles.section} aria-labelledby="section-profile">
        <h2 id="section-profile" className={styles.sectionHeading}>
          {t('settings.yourProfile')}
        </h2>
        <DisplayNameSetting />
      </section>

      {/* ---- Section: Contact (optional WhatsApp number shown on shared links) ---- */}
      <ContactSetting className={styles.section} />

      {/* ---- Section: the rule for counting spare copies ---- */}
      <SpareRuleSetting className={styles.section} />

      {/* ---- Section 2: Theme ---- */}
      <section className={styles.section} aria-labelledby="section-theme">
        <h2 id="section-theme" className={styles.sectionHeading}>
          {t('settings.theme')}
        </h2>
        <div className={styles.themeRow}>
          <ThemeToggle />
        </div>
      </section>

      {/* ---- Section: Language ---- */}
      <section className={styles.section} aria-labelledby="section-language">
        <h2 id="section-language" className={styles.sectionHeading}>
          {t('settings.languageHeading')}
        </h2>
        <div className={styles.themeRow}>
          <LanguageToggle />
        </div>
      </section>

      {/* ---- Admin: store catalog sync (owner/admin only) ---- */}
      {user?.role === 'admin' && <StoreSyncAdminSection />}

      {/* ---- Section 3: Account ---- */}
      <section
        className={`${styles.section} ${styles.accountSection}`}
        aria-labelledby="section-account"
      >
        <h2
          id="section-account"
          className={`${styles.sectionHeading} ${styles.accountSectionHeading}`}
        >
          {t('settings.dangerZone')}
        </h2>
        <p className={styles.dangerCopy}>{t('settings.deleteAccountWarning')}</p>
        <div className={styles.accountActions}>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setDeleteOpen(true)}
          >
            {t('settings.deleteMyAccount')}
          </button>
        </div>
      </section>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          // Redirect to the landing page. `AuthProvider.deleteAccount` has
          // already cleared the JWT + user, so the `_auth` layout will
          // bounce unauthenticated visits back to `/` anyway, but an
          // explicit navigate avoids a flash of the settings shell.
          navigate({ to: '/' });
        }}
      />
    </div>
  );
}
