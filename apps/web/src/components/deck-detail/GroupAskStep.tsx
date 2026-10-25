import React from 'react';
import { useTranslation } from 'react-i18next';
import { useOwnSharedDeckQuery, type ILinkState } from '../../api/shared-decks';
import { buildGroupAskMessage } from '../share/groupAskMessage';
import { GroupAskEditor } from '../share/GroupAskEditor';
import { versionShareUrl } from '../share/shareUrlVersion';
import styles from '../share/ShareSteps.module.css';

interface IGroupAskStepProps {
  readonly deckName: string;
  readonly link: ILinkState;
}

/** Third step of "Pedir as cartas que faltam": reads the owner's own view of the link, then offers the message. */
export function GroupAskStep({ deckName, link }: IGroupAskStepProps): React.ReactElement {
  const { t } = useTranslation();
  const own = useOwnSharedDeckQuery(link.token, true);

  if (own.isError) {
    return (
      <p className={styles.error} role="alert">
        {t('sharing.dialog.enableFailed')}
      </p>
    );
  }
  if (own.data === undefined) {
    return (
      <p className={styles.placeholder} role="status">
        {t('sharing.dialog.preparing')}
      </p>
    );
  }

  const cards = own.data.missing.map((card) => ({
    cardIdentifier: card.cardIdentifier,
    name: card.name,
    pitch: card.pitch,
    quantity: card.quantity,
    inventoryQuantity: card.inventoryQuantity,
    state: card.state,
    availableCopies: card.availableCopies,
  }));
  // WhatsApp keeps the preview of an address it has shown, so the address changes with what the message asks for.
  const withoutAddress = buildGroupAskMessage(
    { deckName, hero: own.data.hero, url: '', cards, closingLine: '', includeStoreSide: false },
    t,
  );

  return <GroupAskEditor deckName={deckName} hero={own.data.hero} url={versionShareUrl(link.url, withoutAddress)} cards={cards} />;
}
