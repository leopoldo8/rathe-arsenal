import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { usePatchDeckMutation } from '../../api/decks';
import { useDeleteDeckWithUndo } from '../../hooks/useDeleteDeckWithUndo';
import styles from './DeckDangerZone.module.css';

interface IDeckDangerZoneProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: TDeckStatus;
  readonly onRetired: () => void;
}

export function DeckDangerZone({
  deckId,
  deckName,
  status,
  onRetired,
}: IDeckDangerZoneProps): React.ReactElement {
  const { t } = useTranslation();
  const patchMutation = usePatchDeckMutation(deckId);
  const navigate = useNavigate();
  const deleteDeck = useDeleteDeckWithUndo();
  const [retireFailed, setRetireFailed] = useState(false);

  const isRetired = status === 'retired';

  function handleRetire(): void {
    setRetireFailed(false);
    patchMutation.mutate(
      { status: 'retired' },
      {
        onSuccess: onRetired,
        onError: () => setRetireFailed(true),
      },
    );
  }

  // Deleting is undoable ("Desfazer", "Excluídos recentemente"), so it asks nothing: the home shows the toast.
  function handleDelete(): void {
    void deleteDeck({ id: deckId, name: deckName }).then((deleted) => {
      if (deleted) void navigate({ to: '/home', search: { tag: [] } });
    });
  }

  return (
    <section
      className={styles.zone}
      aria-labelledby="deck-edit-danger-title"
      data-testid="deck-danger-zone"
    >
      <h2 id="deck-edit-danger-title" className={styles.title}>
        {t('deckEdit.dangerTitle')}
      </h2>

      <div className={styles.row}>
        <div className={styles.copy}>
          <h3 className={styles.rowTitle}>{t('deckEdit.retireTitle')}</h3>
          <p className={styles.rowDesc}>
            {isRetired ? t('deckEdit.retiredNote') : t('deckEdit.retireDesc')}
          </p>
          {retireFailed && (
            <p className={styles.error} role="alert">
              {t('deckEdit.retireError')}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.retireBtn}
          disabled={isRetired || patchMutation.isPending}
          onClick={handleRetire}
          data-testid="deck-retire-btn"
        >
          {patchMutation.isPending ? t('deckEdit.retiring') : t('deckEdit.retireButton')}
        </button>
      </div>

      <div className={styles.row}>
        <div className={styles.copy}>
          <h3 className={styles.rowTitle}>{t('deckEdit.deleteTitle')}</h3>
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={handleDelete}
          data-testid="deck-delete-btn"
        >
          {t('deckEdit.deleteButton')}
        </button>
      </div>

    </section>
  );
}
