import './styles/global.css';
import './i18n'; // side-effect: initialise the i18next singleton on app boot
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/ui/Toast/Toast';
import { AppErrorBoundary } from './components/error/AppErrorBoundary';
import { initWebSentry } from './observability/sentry';
import { routeTree } from './routeTree.gen';

initWebSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
