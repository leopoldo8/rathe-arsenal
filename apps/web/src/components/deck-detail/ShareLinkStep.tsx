import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sharedDeckImageDownloadPath,
  useDisableDeckShareMutation,
  type ILinkState,
} from '../../api/shared-decks';
import { buildWhatsappShareUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { DeckShareContact } from './DeckShareContact';
import styles from './ShareFlow.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface IShareLinkStepProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly link: ILinkState;
  /** Called once the link is switched off, so the dialog goes back to the choice. */
  readonly onTurnedOff: () => void;
}

/** Third step: the chosen link, ready to send. */
export function ShareLinkStep({ deckId, deckName, link, onTurnedOff }: IShareLinkStepProps): React.ReactElement {
  const { t } = useTranslation();
  const disable = useDisableDeckShareMutation(deckId);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [confirmingOff, setConfirmingOff] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  const message = t(link.intent === 'deck' ? 'sharing.dialog.messageDeck' : 'sharing.dialog.messageMissing', {
    deck: deckName,
  });
  const whatsappHref = buildWhatsappShareUrl(`${message}\n${link.url}`);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  function handleTurnOff(): void {
    disable.mutate(link.intent, { onSuccess: onTurnedOff });
  }

  return (
    <>
      <div className={styles.addressRow}>
        <input
          className={styles.address}
          type="text"
          readOnly
          value={link.url}
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

      <a
        className={styles.whatsappBtn}
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="share-whatsapp"
      >
        <WhatsappGlyph />
        {t('sharing.dialog.sendWhatsapp')}
      </a>

      <DeckShareContact deckId={deckId} intent={link.intent} showContact={link.showContact} />

      {disable.isError && (
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
                onClick={handleTurnOff}
                aria-disabled={disable.isPending || undefined}
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
            <a
              className={styles.textBtn}
              href={sharedDeckImageDownloadPath(link.token)}
              download
              data-testid="share-download"
            >
              {t('sharing.dialog.download')}
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
