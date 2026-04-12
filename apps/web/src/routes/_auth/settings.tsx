import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { DeleteAccountModal } from '../../components/delete-account-modal';

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage,
});

/**
 * Phase 1a Unit 2 (A8) — minimal settings surface. Currently holds only the
 * account-deletion entry point. As Phase 1 grows (email change, password
 * change, notification preferences) this page will expand; the URL is
 * stable so future deep-links stay valid.
 */
function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section style={{ maxWidth: '640px' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Account settings</h1>
      {user && (
        <p style={{ color: '#666', marginTop: 0 }}>
          Signed in as <strong>{user.email}</strong>
        </p>
      )}

      <section
        style={{
          marginTop: '2rem',
          padding: '1.25rem',
          border: '1px solid #f5c6c1',
          borderRadius: '8px',
          background: '#fdecea',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#7a1f14' }}>Danger zone</h2>
        <p style={{ color: '#7a1f14', marginTop: 0 }}>
          Deleting your account marks it for permanent removal after 30 days.
          You will be signed out immediately and your collection, tracked
          decks, and readiness history will be erased.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.875rem',
            background: '#c0392b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Delete my account
        </button>
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
    </section>
  );
}
