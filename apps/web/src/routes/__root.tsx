import { Outlet, createRootRoute, Link } from '@tanstack/react-router';
import { useAuth } from '../auth/useAuth';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="app-shell">
      <header style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <strong>Rathe Arsenal</strong>
        </Link>
        <span style={{ color: '#888', fontSize: '0.875rem' }}>
          Your Flesh and Blood collection, ready to play.
        </span>
        <span style={{ flex: 1 }} />
        {user && (
          <>
            <span style={{ fontSize: '0.875rem' }}>{user.email}</span>
            <button onClick={signOut} style={{ cursor: 'pointer' }}>Sign out</button>
          </>
        )}
      </header>
      <main style={{ padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
