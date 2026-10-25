import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  useDeletedDecksQuery,
  usePermanentDeleteDeckMutation,
  useRestoreDeckMutation,
  type IDeletedDeck,
} from '../../api/deleted-decks';
import { deletedDeckMeta } from './deletedDeckMeta';
import { PermanentDeleteDialog } from './PermanentDeleteDialog';
import styles from './DeletedDecksPage.module.css';

/** "Excluídos recentemente": each deleted deck with "Restaurar" and, as a plain link, "Excluir de vez". */
export function DeletedDecksPage(): React.ReactElement {
  const { t } = useTranslation();
  const query = useDeletedDecksQuery();
  const restore = useRestoreDeckMutation();
  const permanent = usePermanentDeleteDeckMutation();
  const [asking, setAsking] = React.useState<IDeletedDeck | null>(null);
  const now = new Date();
  const decks = query.data?.decks ?? [];
  const failed = restore.isError || permanent.isError;

  function confirmPermanent(): void {
    if (asking === null) return;
    permanent.mutate(asking.id);
    setAsking(null);
  }

  return (
    <div className={styles.page}>
      <Link to="/home" search={{ tag: [] }} className={styles.back}>
        {t('home.deletedBack')}
      </Link>
      <h1 className={styles.title}>{t('home.deletedTitle')}</h1>
      <p className={styles.intro}>{t('home.deletedIntro')}</p>
      {query.isError && (
        <p className={styles.error} role="alert">
          {t('home.deletedLoadFailed')}
        </p>
      )}
      {failed && (
        <p className={styles.error} role="alert">
          {t('home.deletedActionFailed')}
        </p>
      )}
      {query.isSuccess && decks.length === 0 && <p className={styles.empty}>{t('home.deletedEmpty')}</p>}
      <ul className={styles.list}>
        {decks.map((deck) => (
          <li key={deck.id} className={styles.card} data-testid="deleted-deck">
            <h2 className={styles.name}>{deck.name}</h2>
            <p className={styles.meta}>{deletedDeckMeta(deck, now, t)}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.restore}
                aria-label={t('home.deletedRestoreAria', { name: deck.name })}
                disabled={restore.isPending}
                onClick={() => restore.mutate(deck.id)}
              >
                {t('home.deletedRestore')}
              </button>
              <button
                type="button"
                className={styles.forGood}
                aria-label={t('home.deletedDeleteForGoodAria', { name: deck.name })}
                onClick={() => setAsking(deck)}
              >
                {t('home.deletedDeleteForGood')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <PermanentDeleteDialog deckName={asking?.name ?? null} onConfirm={confirmPermanent} onCancel={() => setAsking(null)} />
    </div>
  );
}
