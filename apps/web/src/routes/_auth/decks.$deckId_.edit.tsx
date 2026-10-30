import React, { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDeckDetailQuery } from '../../api/deck-detail';
import { useTagsQuery } from '../../api/tags';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { DeckEditForm } from '../../components/deck-edit/DeckEditForm';
import { resolveDeckTags } from '../../components/deck-edit/deckEditModel';
import { IndexRail, RailLayout } from '../../components/ui/RailLayout';
import styles from './decks.$deckId_.edit.module.css';

export const Route = createFileRoute('/_auth/decks/$deckId_/edit')({
  component: DeckEditPage,
});

export function DeckEditPage(): React.ReactElement {
  const { deckId } = Route.useParams();
  const { t } = useTranslation();
  const detailQuery = useDeckDetailQuery(deckId);
  const tagsQuery = useTagsQuery();
  const deck = detailQuery.data;
  const sectionItems = useMemo(
    () => [
      { id: 'deck-edit-field-name', label: t('deckEdit.nameLabel') },
      { id: 'deck-edit-field-format', label: t('deckEdit.formatLabel') },
      { id: 'deck-edit-field-status', label: t('deckEdit.statusLabel') },
      { id: 'deck-edit-field-tags', label: t('deckEdit.tagsLabel') },
      { id: 'deck-edit-field-notes', label: t('deckEdit.notesLabel') },
      { id: 'deck-edit-danger', label: t('deckEdit.dangerTitle'), tone: 'danger' as const },
    ],
    [t],
  );

  return (
    <RailLayout
      className={styles.page}
      testId="deck-edit-page"
      railLabel={t('deckEdit.sectionsLabel')}
      rail={<IndexRail items={sectionItems} />}
      head={
        <header className={styles.header}>
          <Link
            to="/decks/$deckId"
            params={{ deckId }}
            search={{ edit: undefined }}
            className={styles.back}
            aria-label={t('deckEdit.backToDeckAria', { name: deck?.name ?? '' })}
          >
            {t('deckEdit.backToDeck')}
          </Link>
          <h1 className={styles.title}>{t('deckEdit.pageTitle')}</h1>
        </header>
      }
    >
      {detailQuery.isLoading && (
        <div role="status" aria-label={t('deckEdit.loadingAria')}>
          <Skeleton height="320px" />
        </div>
      )}

      {detailQuery.isError && (
        <div role="alert" className={styles.loadError}>
          <p>{t('decks.failedToLoadDeck', { error: (detailQuery.error as Error).message })}</p>
          <button type="button" className={styles.retryBtn} onClick={() => void detailQuery.refetch()}>
            {t('decks.retry')}
          </button>
        </div>
      )}

      {deck != null && (
        <DeckEditForm
          deck={deck}
          tags={resolveDeckTags(deck.tags, tagsQuery.data?.tags ?? [])}
        />
      )}
    </RailLayout>
  );
}
