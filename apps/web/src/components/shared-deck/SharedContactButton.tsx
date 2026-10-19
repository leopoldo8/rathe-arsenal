import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TShareIntent } from '../../api/shared-decks';
import { buildWhatsappUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import styles from './SharedContactButton.module.css';

interface ISharedContactButtonProps {
  readonly whatsapp: string;
  readonly sharerName: string;
  readonly deckName: string;
  readonly intent: TShareIntent;
  /** The page's main action (missing-cards link): solid green instead of outlined. */
  readonly primary?: boolean;
  /** `pill`: beside the sharer's name (desktop). `bar`: full-width button in the fixed bottom bar (phone). */
  readonly variant: 'pill' | 'bar';
}

/** Opens a WhatsApp chat with the sharer, with a ready message naming the deck. */
export function SharedContactButton({
  whatsapp,
  sharerName,
  deckName,
  intent,
  primary = false,
  variant,
}: ISharedContactButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const href = buildWhatsappUrl(whatsapp, t(intent === 'missing' ? 'sharing.contact.messageMissing' : 'sharing.contact.message', { deck: deckName }));
  const label = t('sharing.contact.chatButton', { name: sharerName });

  if (variant === 'pill') {
    return (
      <a
        className={primary ? `${styles.pill} ${styles.pillPrimary}` : styles.pill}
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
    </div>
  );
}
