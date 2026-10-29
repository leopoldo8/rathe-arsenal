import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ILinkState } from '../../api/shared-decks';
import { ShareAddressRow } from '../share/ShareAddressRow';
import { ShareWhatsappButton } from '../share/ShareWhatsappButton';

interface IQuoteLinkStepProps {
  readonly link: ILinkState;
}

/** Third step of "Pedir orçamento a uma loja": the quote address and the request that goes with it. */
export function QuoteLinkStep({ link }: IQuoteLinkStepProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <ShareAddressRow url={link.url} />
      <ShareWhatsappButton message={t('sharing.dialog.quoteMessage', { url: link.url })} />
    </>
  );
}
