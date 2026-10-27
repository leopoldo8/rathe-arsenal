import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ShareSteps.module.css';

interface IShareTurnOffRowProps {
  readonly turningOff: boolean;
  readonly turnOffFailed: boolean;
  readonly onTurnOff: () => void;
}

/** Last row of the missing message step (`r6-turnoff-a-phone`): turn the link off, after one question. */
export function ShareTurnOffRow({ turningOff, turnOffFailed, onTurnOff }: IShareTurnOffRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  // A refused request puts the plain row back, with the alert above it, so the owner can try again.
  useEffect(() => {
    if (turnOffFailed) setConfirming(false);
  }, [turnOffFailed]);

  return (
    <div className={styles.turnOffRow}>
      {turnOffFailed && (
        <p className={styles.error} role="alert">
          {t('sharing.dialog.turnOffFailed')}
        </p>
      )}
      {confirming ? (
        <div className={styles.turnOffAsk}>
          <span className={styles.confirmText}>{t('sharing.dialog.turnOffConfirm')}</span>
          <span className={styles.turnOffActions}>
            <button
              type="button"
              className={`${styles.turnOffBtn} ${styles.danger}`}
              onClick={onTurnOff}
              aria-disabled={turningOff || undefined}
              data-testid="share-turn-off-confirm"
            >
              {t('sharing.dialog.turnOffYes')}
            </button>
            <button type="button" className={`${styles.turnOffBtn} ${styles.turnOffKeep}`} onClick={() => setConfirming(false)}>
              {t('sharing.dialog.turnOffNo')}
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className={`${styles.turnOffBtn} ${styles.danger} ${styles.turnOffAlone}`} onClick={() => setConfirming(true)} data-testid="share-turn-off">
          {t('sharing.dialog.turnOff')}
        </button>
      )}
    </div>
  );
}
