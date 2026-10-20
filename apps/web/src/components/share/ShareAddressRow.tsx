import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ShareSteps.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface IShareAddressRowProps {
  readonly url: string;
}

/** The link's address with its "Copiar" button; the button confirms for a moment. */
export function ShareAddressRow({ url }: IShareAddressRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  return (
    <>
      <div className={styles.addressRow}>
        <input
          className={styles.address}
          type="text"
          readOnly
          value={url}
          aria-label={t('sharing.dialog.addressLabel')}
          onFocus={(event) => event.currentTarget.select()}
          data-testid="share-address"
        />
        <button type="button" className={styles.secondaryBtn} onClick={() => void handleCopy()}>
          {copyState === 'copied' ? t('sharing.dialog.copied') : t('sharing.dialog.copy')}
        </button>
      </div>
      <p className={styles.status} role="status">
        {copyState === 'failed' ? t('sharing.dialog.copyFailed') : ''}
      </p>
    </>
  );
}
