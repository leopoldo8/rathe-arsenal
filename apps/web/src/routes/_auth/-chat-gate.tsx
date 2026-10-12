import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '../../auth/useAuth';
import { DEFAULT_HOME_SEARCH } from './-home.helpers';

export function ChatGate({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const { user } = useAuth();
  if (user?.chatAccess !== true) return <Navigate to="/home" search={DEFAULT_HOME_SEARCH} replace />;
  return <>{children}</>;
}
