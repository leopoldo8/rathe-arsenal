import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePickReplacement, useResolveReplacement } from '../../api/replacements';
import type { IMissingLine } from '../../api/missing-list';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import { localizeApiError } from '../card-scanner/localize-api-error';
import styles from './MissingStandIn.module.css';

interface IMissingStandInProps {
  readonly deckId: number;
  readonly line: IMissingLine;
}

/** The stand-in a row offers ("Usar") or already holds ("Desfazer"), for as many copies as it covers. */
export function MissingStandIn({ deckId, line }: IMissingStandInProps): React.ReactElement | null {
  const { t } = useTranslation();
  const pick = usePickReplacement(deckId);
  const resolve = useResolveReplacement(deckId);
  const [error, setError] = useState<string | null>(null);
  const standIn = line.standIn;
  if (standIn === null) return null;

  const name = cardName(line.name, line.pitch, t);
  const standInName = cardName(standIn.name, standIn.pitch, t);
  const saving = standIn.savingCents === null ? null : formatBrl(standIn.savingCents);
  const params = { count: standIn.copies, covers: standIn.copies, standIn: standInName, saving: saving ?? '' };

  function handleUse(): void {
    if (standIn === null) return;
    setError(null);
    pick.mutate(
      {
        originalCardIdentifier: line.cardIdentifier,
        slot: line.slot,
        replacementCardIdentifier: standIn.cardIdentifier,
        pickedFrom: 'suggested',
        quantity: standIn.copies,
      },
      { onError: (failure) => setError(localizeApiError(failure, t)) },
    );
  }

  function handleUndo(): void {
    if (standIn?.replacementId == null) return;
    setError(null);
    resolve.mutate(
      { id: standIn.replacementId, action: 'revert' },
      { onError: (failure) => setError(localizeApiError(failure, t)) },
    );
  }

  const text = standIn.used
    ? t(saving === null ? 'missingList.standInUsedNoSaving' : 'missingList.standInUsed', params)
    : t(saving === null ? 'missingList.standInOfferNoSaving' : 'missingList.standInOffer', params);

  return (
    <div className={standIn.used ? `${styles.block} ${styles.used}` : styles.block} data-testid="missing-stand-in">
      <p className={styles.text}>{text}</p>
      <button
        type="button"
        className={standIn.used ? styles.undo : styles.use}
        aria-label={
          standIn.used
            ? t('missingList.undoAria', { name })
            : t('missingList.useAria', { standIn: standInName, name })
        }
        disabled={pick.isPending || resolve.isPending}
        onClick={standIn.used ? handleUndo : handleUse}
      >
        {standIn.used ? t('missingList.undo') : t('missingList.use')}
      </button>
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
