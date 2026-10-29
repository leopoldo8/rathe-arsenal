import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { postShareEvent } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';
import { buildWhatsappUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { ShareDialogFrame } from '../share/ShareDialogFrame';
import { useToast } from '../ui/Toast/useToast';
import styles from './OfferButton.module.css';

export interface IOfferItem {
  readonly name: string;
  readonly pitch: number | null;
  /** Copies the visitor says they have. */
  readonly count: number;
}

interface IOfferButtonProps {
  readonly token: string;
  readonly sharerName: string;
  /** Digits with country code; null when the link shows no number. */
  readonly whatsapp: string | null;
  readonly items: readonly IOfferItem[];
  /** `single` is one card's button and sends at once; `all` opens the message first. */
  readonly variant: 'single' | 'all';
  readonly label: string;
  readonly ariaLabel?: string | undefined;
}

/** "Oferecer": answers the sharer's request on WhatsApp, or copies the same text when the link shows no number. */
export function OfferButton({ token, sharerName, whatsapp, items, variant, label, ariaLabel }: IOfferButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const lines = items.map((item) =>
    t('sharing.missingPage.offerLine', { count: item.count, card: cardName(item.name, item.pitch, (key) => t(key)) }),
  );
  const first = items[0];
  const message =
    items.length === 1 && first !== undefined
      ? t('sharing.missingPage.offerSingle', {
          name: sharerName,
          count: first.count,
          card: cardName(first.name, first.pitch, (key) => t(key)),
        })
      : [t('sharing.missingPage.offerHead', { name: sharerName }), ...lines].join('\n');

  async function send(): Promise<void> {
    // Counting the offer must never stop it: a failed post is dropped.
    void postShareEvent(token, 'offer').catch(() => undefined);
    if (whatsapp !== null) {
      window.open(buildWhatsappUrl(whatsapp, message), '_blank', 'noopener,noreferrer');
      setSheetOpen(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      show({ kind: 'success', message: t('sharing.missingPage.offerCopied') });
      setSheetOpen(false);
    } catch {
      show({ kind: 'error', message: t('sharing.missingPage.offerCopyFailed') });
    }
  }

  const trigger = (
    <button
      type="button"
      className={variant === 'all' ? `${styles.offer} ${styles.offerAll}` : styles.offer}
      aria-label={ariaLabel}
      onClick={() => (variant === 'all' ? setSheetOpen(true) : void send())}
    >
      <WhatsappGlyph />
      {label}
    </button>
  );
  if (variant === 'single') return trigger;

  return (
    <>
      {trigger}
      <ShareDialogFrame open={sheetOpen} onOpenChange={setSheetOpen}>
        <OfferSheet
          sharerName={sharerName}
          message={message}
          hasNumber={whatsapp !== null}
          onSend={() => void send()}
          onClose={() => setSheetOpen(false)}
        />
      </ShareDialogFrame>
    </>
  );
}

interface IOfferSheetProps {
  readonly sharerName: string;
  readonly message: string;
  readonly hasNumber: boolean;
  readonly onSend: () => void;
  readonly onClose: () => void;
}

function OfferSheet({ sharerName, message, hasNumber, onSend, onClose }: IOfferSheetProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <Dialog.Title className={styles.eyebrow}>{t('sharing.missingPage.offerSheetEyebrow', { name: sharerName })}</Dialog.Title>
        <button type="button" className={styles.close} aria-label={t('sharing.missingPage.offerSheetClose')} onClick={onClose}>
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>
      <h2 className={styles.heading}>{t('sharing.missingPage.offerSheetTitle')}</h2>
      <p className={styles.hint}>{t('sharing.missingPage.offerSheetHint')}</p>
      <p className={styles.message} data-testid="offer-message">
        {message}
      </p>
      <button type="button" className={styles.send} onClick={onSend}>
        <WhatsappGlyph />
        {hasNumber ? t('sharing.missingPage.offerSheetSend') : t('sharing.missingPage.offerSheetCopy')}
      </button>
    </div>
  );
}
