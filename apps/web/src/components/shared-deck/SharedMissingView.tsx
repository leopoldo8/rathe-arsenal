import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { ISharedDeckResponse } from '../../api/shared-decks';
import { SharedCardRow } from './SharedCardRow';
import { buildMissingText } from './sharedDeckModel';
import styles from './SharedMissingView.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface ISharedMissingViewProps {
  readonly deck: ISharedDeckResponse;
  readonly onClose: () => void;
}

/**
 * "Only what is missing" (?view=missing): a side panel on desktop and a bottom
 * sheet on phones, over the full deck. Offers the list as text, one
 * "2x Name (pitch)" line per card followed by the share address.
 */
export function SharedMissingView({ deck, onClose }: ISharedMissingViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = buildMissingText(deck.missing, deck.url, (key, options) => (options === undefined ? t(key) : t(key, options)) as string);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} data-testid="shared-missing-view">
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>
              {t('sharing.missing.titleCount', { count: deck.missingCount })}
            </Dialog.Title>
            <Dialog.Close className={styles.close} aria-label={t('sharing.missing.closeAria')}>
              {t('sharing.missing.close')}
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.subtitle}>
            {t('sharing.missing.subtitle', { name: deck.sharerName })}
          </Dialog.Description>

          {deck.missing.length === 0 ? (
            <p className={styles.empty}>{t('sharing.missing.empty', { name: deck.sharerName })}</p>
          ) : (
            <>
              <ul className={styles.rows} data-testid="shared-missing-rows">
                {deck.missing.map((card) => (
                  <SharedCardRow key={`${card.cardIdentifier}::${card.slot}`} card={card} />
                ))}
              </ul>
              <p className={styles.caption}>{t('sharing.missing.howCopied')}</p>
              <pre className={styles.text} data-testid="shared-missing-text">
                {text}
              </pre>
              <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()}>
                {copyState === 'copied' ? t('sharing.missing.copied') : t('sharing.missing.copyText')}
              </button>
              <p className={styles.status} role="status">
                {copyState === 'failed' ? t('sharing.missing.copyFailed') : ''}
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
