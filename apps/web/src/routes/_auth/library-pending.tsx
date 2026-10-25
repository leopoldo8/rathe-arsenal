import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PendingResolver } from '../../components/collection-reader/PendingResolver';

interface IPendingSearch {
  readonly source?: string;
}

export const Route = createFileRoute('/_auth/library-pending')({
  validateSearch: (search: Record<string, unknown>): IPendingSearch =>
    typeof search['source'] === 'string' ? { source: search['source'] } : {},
  component: LibraryPendingPage,
});

export function LibraryPendingPage(): React.ReactElement {
  const { source } = Route.useSearch();
  return <PendingResolver sourceId={source} />;
}
