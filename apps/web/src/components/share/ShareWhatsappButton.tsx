import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildWhatsappShareUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import styles from './ShareSteps.module.css';

interface IShareWhatsappButtonProps {
  /** Null while the message is still being put together. */
  readonly message: string | null;
}

/** Opens WhatsApp with the message; the sender picks the chat or group. */
export function ShareWhatsappButton({ message }: IShareWhatsappButtonProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <a
      className={styles.whatsappBtn}
      href={message === null ? undefined : buildWhatsappShareUrl(message)}
      aria-disabled={message === null ? true : undefined}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="share-whatsapp"
    >
      <WhatsappGlyph />
      {t('sharing.dialog.sendWhatsapp')}
    </a>
  );
}
