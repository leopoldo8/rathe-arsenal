import { Outlet, createFileRoute, Navigate } from '@tanstack/react-router';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/sign-in" />;
  return <Outlet />;
}
