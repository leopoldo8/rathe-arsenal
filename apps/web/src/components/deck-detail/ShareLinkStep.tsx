import React from "react";
import { useTranslation } from "react-i18next";
import {
  sharedDeckImageDownloadPath,
  useDisableDeckShareMutation,
  useOwnSharedDeckQuery,
  useSetDeckShareContactMutation,
  type ILinkState,
} from "../../api/shared-decks";
import { ShareAddressRow } from "../share/ShareAddressRow";
import { ShareContactRow } from "../share/ShareContactRow";
import { ShareLinkFooter } from "../share/ShareLinkFooter";
import { ShareWhatsappButton } from "../share/ShareWhatsappButton";
import { buildMissingMessage } from "../shared-deck/sharedDeckModel";
import { versionShareUrl } from "../share/shareUrlVersion";

interface IShareLinkStepProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly link: ILinkState;
  /** Called once the link is switched off, so the dialog goes back to the choice. */
  readonly onTurnedOff: () => void;
}

/** Third step: the chosen link, ready to send. */
export function ShareLinkStep({
  deckId,
  deckName,
  link,
  onTurnedOff,
}: IShareLinkStepProps): React.ReactElement {
  const { t } = useTranslation();
  const disable = useDisableDeckShareMutation(deckId);
  const setContact = useSetDeckShareContactMutation(deckId);

  const isMissing = link.intent === "missing";
  const ownView = useOwnSharedDeckQuery(link.token, isMissing);
  const translate = (key: string, options?: Record<string, unknown>): string =>
    (options === undefined ? t(key) : t(key, options)) as string;
  const missingUrl =
    isMissing && ownView.data !== undefined
      ? versionShareUrl(link.url, buildMissingMessage({ ...ownView.data, url: "" }, translate))
      : link.url;
  const message =
    isMissing && ownView.data !== undefined
      ? buildMissingMessage({ ...ownView.data, url: missingUrl }, translate)
      : `${t("sharing.dialog.messageDeck", { deck: deckName })}\n${link.url}`;
  const whatsappReady = !isMissing || ownView.data !== undefined;

  return (
    <>
      <ShareAddressRow url={missingUrl} />
      <ShareWhatsappButton message={whatsappReady ? message : null} />
      <ShareContactRow
        testId="deck-share-contact"
        showContact={link.showContact}
        updating={setContact.isPending}
        onToggle={(next, onFailed) =>
          setContact.mutate({ intent: link.intent, showContact: next }, { onError: onFailed })
        }
      />
      <ShareLinkFooter
        downloadHref={sharedDeckImageDownloadPath(link.token)}
        downloadLabel={t(isMissing ? "sharing.dialog.downloadMissing" : "sharing.dialog.downloadDeck")}
        turningOff={disable.isPending}
        turnOffFailed={disable.isError}
        onTurnOff={() => disable.mutate(link.intent, { onSuccess: onTurnedOff })}
      />
    </>
  );
}
