import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { DeleteAccountModal } from '../../components/delete-account-modal';
import { ThemeToggle } from '../../components/shell/ThemeToggle';
import { useTriggerUrlSyncMutation, useUrlSyncStatusQuery } from '../../api/store-admin';
import styles from './settings.module.css';

/**
 * Admin-only control to trigger the store catalog URL-sync (productUrl + name
 * discovery via Firecrawl). Rendered only for `role === 'admin'`, so its
 * admin-gated API calls never fire for regular users.
 */
function StoreSyncAdminSection() {
  const { data: status } = useUrlSyncStatusQuery();
  const trigger = useTriggerUrlSyncMutation();
  const busy = status?.state === 'queued' || status?.state === 'running' || trigger.isPending;

  const statusLine = (() => {
    if (status?.state === 'running') return 'Syncing catalog… this takes a few minutes.';
    if (status?.state === 'queued') return 'Queued — the worker will start shortly.';
    if (status?.lastUrlSyncAt) {
      const when = new Date(status.lastUrlSyncAt).toLocaleString();
      return `Last sync: ${status.lastProductCount ?? 0} products · ${when}`;
    }
    return 'Never synced.';
  })();

  return (
    <section className={styles.section} aria-labelledby="section-store-sync">
      <span className={styles.eyebrow}>Admin</span>
      <h2 id="section-store-sync" className={styles.sectionHeading}>
        Store catalog sync
      </h2>
      <p className={styles.dangerCopy}>
        Re-scans the store to discover new cards&rsquo; product pages (e.g. after a
        new set release). Runs in the background via Firecrawl — trigger it once
        when a set drops.
      </p>
      <div className={styles.syncRow}>
        <button
          type="button"
          className={styles.syncBtn}
          disabled={busy}
          onClick={() => trigger.mutate()}
          data-testid="store-sync-trigger"
        >
          {busy ? 'Sync in progress…' : 'Sync store catalog'}
        </button>
        <span className={styles.syncStatus} data-testid="store-sync-status">{statusLine}</span>
      </div>
      {trigger.isError && (
        <p className={styles.syncError}>Could not queue the sync. Try again.</p>
      )}
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
 *  1. Profile  — email displayed read-only (display-name is out of v1 scope)
 *  2. Theme    — ThemeToggle (client-side; backend persistence wires in Unit 12)
 *  3. Account  — change-password link + delete-account trigger
 *
 * Zero inline styles — all layout is handled by settings.module.css.
 */
export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageHeading}>Account settings</h1>

      {/* ---- Section 1: Profile ---- */}
      <section className={styles.section} aria-labelledby="section-profile">
        <span className={styles.eyebrow}>Profile</span>
        <h2 id="section-profile" className={styles.sectionHeading}>
          Your profile
        </h2>
        <div className={styles.emailRow}>
          <span className={styles.emailLabel}>Email address</span>
          <span className={styles.emailValue}>{user?.email ?? '—'}</span>
        </div>
      </section>

      {/* ---- Section 2: Theme ---- */}
      <section className={styles.section} aria-labelledby="section-theme">
        <span className={styles.eyebrow}>Appearance</span>
        <h2 id="section-theme" className={styles.sectionHeading}>
          Theme
        </h2>
        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>Color theme</span>
          <ThemeToggle />
        </div>
      </section>

      {/* ---- Admin: store catalog sync (owner/admin only) ---- */}
      {user?.role === 'admin' && <StoreSyncAdminSection />}

      {/* ---- Section 3: Account ---- */}
      <section
        className={`${styles.section} ${styles.accountSection}`}
        aria-labelledby="section-account"
      >
        <span className={styles.eyebrow}>Account</span>
        <h2
          id="section-account"
          className={`${styles.sectionHeading} ${styles.accountSectionHeading}`}
        >
          Danger zone
        </h2>
        <p className={styles.dangerCopy}>
          Deleting your account marks it for permanent removal after 30 days.
          You will be signed out immediately and your collection, tracked decks,
          and readiness history will be erased.
        </p>
        <div className={styles.accountActions}>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setDeleteOpen(true)}
          >
            Delete my account
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
