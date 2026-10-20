import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ShareSteps.module.css';

interface IShareLinkFooterProps {
  readonly downloadHref: string;
  readonly downloadLabel: string;
  readonly turningOff: boolean;
  readonly turnOffFailed: boolean;
  readonly onTurnOff: () => void;
}

/** Small actions at the foot of the link step: download the image, and turn the link off after a confirm. */
export function ShareLinkFooter({
  downloadHref,
  downloadLabel,
  turningOff,
  turnOffFailed,
  onTurnOff,
}: IShareLinkFooterProps): React.ReactElement {
  const { t } = useTranslation();
  const [confirmingOff, setConfirmingOff] = useState(false);

  return (
    <>
      {turnOffFailed && (
        <p className={styles.error} role="alert">
          {t('sharing.dialog.turnOffFailed')}
        </p>
      )}
      <div className={styles.footer}>
        {confirmingOff ? (
          <>
            <span className={styles.confirmText}>{t('sharing.dialog.turnOffConfirm')}</span>
            <span className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.textBtn} ${styles.danger}`}
                onClick={onTurnOff}
                aria-disabled={turningOff || undefined}
                data-testid="share-turn-off-confirm"
              >
                {t('sharing.dialog.turnOffYes')}
              </button>
              <button type="button" className={styles.textBtn} onClick={() => setConfirmingOff(false)}>
                {t('sharing.dialog.turnOffNo')}
              </button>
            </span>
          </>
        ) : (
          <>
            <a className={styles.textBtn} href={downloadHref} download data-testid="share-download">
              {downloadLabel}
            </a>
            <button
              type="button"
              className={styles.textBtn}
              onClick={() => setConfirmingOff(true)}
              data-testid="share-turn-off"
            >
              {t('sharing.dialog.turnOff')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
