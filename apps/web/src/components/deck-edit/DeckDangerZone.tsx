import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { usePatchDeckMutation } from '../../api/decks';
import { DeleteDeckDialog } from './DeleteDeckDialog';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
          <p className={styles.rowDesc}>{t('deckEdit.deleteDesc')}</p>
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => setConfirmOpen(true)}
          data-testid="deck-delete-btn"
        >
          {t('deckEdit.deleteButton')}
        </button>
      </div>

      <DeleteDeckDialog deckId={deckId} deckName={deckName} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </section>
  );
}
