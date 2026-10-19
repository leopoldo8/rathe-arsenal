import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildWhatsappUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import styles from './SharedContactButton.module.css';

interface ISharedContactButtonProps {
  readonly whatsapp: string;
  readonly sharerName: string;
  readonly deckName: string;
  /** `pill`: beside the sharer's name (desktop). `bar`: full-width button in the fixed bottom bar (phone). */
  readonly variant: 'pill' | 'bar';
}

/** Opens a WhatsApp chat with the sharer, with a ready message naming the deck. */
export function SharedContactButton({
  whatsapp,
  sharerName,
  deckName,
  variant,
}: ISharedContactButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const href = buildWhatsappUrl(whatsapp, t('sharing.contact.message', { deck: deckName }));
  const label = t('sharing.contact.chatButton', { name: sharerName });

  if (variant === 'pill') {
    return (
      <a
        className={styles.pill}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        data-testid="shared-contact-pill"
      >
        <WhatsappGlyph />
        {t('sharing.contact.pill')}
      </a>
    );
  }

  return (
    <div className={styles.bar} data-testid="shared-contact-bar">
      <a className={styles.barButton} href={href} target="_blank" rel="noopener noreferrer">
        <WhatsappGlyph />
        {label}
      </a>
      <p className={styles.barNote}>{t('sharing.contact.barNote')}</p>
    </div>
  );
}
