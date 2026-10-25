import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { useCsvSourcesQuery } from '../../api/csv-sources';
import { VersionBulkSheet } from '../../components/collection-versions/VersionBulkSheet';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';

export const Route = createFileRoute('/_auth/library-csv-sources_/$sourceId/versions')({
  component: ImportVersionsPage,
});

export function ImportVersionsPage(): React.ReactElement {
  const { sourceId } = Route.useParams();
  const { t } = useTranslation();
  const sourcesQuery = useCsvSourcesQuery();
  const source = sourcesQuery.data?.find((candidate) => candidate.id === sourceId);

  if (sourcesQuery.isLoading) return <Skeleton width="100%" height="240px" aria-label={t('common.loadingTitle')} />;

  const label =
    source === undefined
      ? ''
      : source.kind === 'manual'
        ? t('csvSources.manualSourceLabel')
        : (source.label ?? source.originalFilename ?? t('csvSources.untitledSourceLabel'));
  return <VersionBulkSheet sourceId={sourceId} label={label} />;
}
