import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ICardList } from '../../api/lists';
import { DISPLAY_NAME_REQUIRED, EMAIL_NOT_CONFIRMED, isShareErrorCode } from '../../api/shared-decks';
import {
  sharedListImageDownloadPath,
  useDisableListShareMutation,
  useEnableListShareMutation,
  useListShareQuery,
  useSetListShareContactMutation,
  type IListLinkState,
} from '../../api/shared-lists';
import { useAuth } from '../../auth/useAuth';
import { ConfirmEmailPanel } from '../confirmation/ConfirmEmailPanel';
import { DisplayNameForm } from '../deck-detail/DisplayNameForm';
import { ShareAddressRow } from '../share/ShareAddressRow';
import { ShareContactRow } from '../share/ShareContactRow';
import { ShareDialogHeader } from '../share/ShareDialogHeader';
import { ShareLinkFooter } from '../share/ShareLinkFooter';
import { ShareWhatsappButton } from '../share/ShareWhatsappButton';
import { useSaveDisplayName } from '../share/useSaveDisplayName';
import shareStyles from '../share/ShareSteps.module.css';
import { buildListShareMessage, versionedListUrl } from './listShareModel';
import { makeTranslate } from './listsModel';

interface IListShareFlowProps {
  readonly list: ICardList;
  readonly onClose: () => void;
}

/**
 * Sharing a list: your name (only if missing), then the link. A list has one
 * kind, so there is nothing to choose; the link is made as soon as the name is known.
 */
export function ListShareFlow({ list, onClose }: IListShareFlowProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const shareQuery = useListShareQuery(list.id);
  const enable = useEnableListShareMutation(list.id);
  const displayName = useSaveDisplayName();
  const [needsName, setNeedsName] = useState(!user?.displayName);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const requested = useRef(false);
  const link = shareQuery.data ?? null;

  function requestLink(): void {
    requested.current = true;
    enable.reset();
    enable.mutate(undefined, {
      onError: (error) => {
        if (isShareErrorCode(error, DISPLAY_NAME_REQUIRED)) {
          requested.current = false;
          setNeedsName(true);
        }
        if (isShareErrorCode(error, EMAIL_NOT_CONFIRMED)) setUnconfirmed(true);
      },
    });
  }

  useEffect(() => {
    if (needsName || !shareQuery.isSuccess || link !== null || requested.current) return;
    requestLink();
    // Runs when the state it reads settles; requestLink only touches refs and stable mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsName, shareQuery.isSuccess, link]);

  async function handleSaveName(name: string): Promise<void> {
    if (await displayName.save(name)) setNeedsName(false);
  }

  if (unconfirmed) return <ConfirmEmailPanel onClose={onClose} />;

  const title = needsName ? t('sharing.dialog.name.title') : t('lists.share.title');
  const failed = link === null && enable.isError && !isShareErrorCode(enable.error, DISPLAY_NAME_REQUIRED);

  return (
    <>
      <ShareDialogHeader title={title} />
      <div className={shareStyles.body}>
        {needsName && (
          <DisplayNameForm
            initialName={user?.displayName ?? ''}
            saving={displayName.saving}
            error={displayName.error}
            submitLabel={t('sharing.dialog.name.continue')}
            onSubmit={(name) => void handleSaveName(name)}
            onCancel={onClose}
          />
        )}
        {!needsName && link !== null && <ListLinkStep key={link.token} list={list} link={link} onTurnedOff={onClose} />}
        {!needsName && failed && (
          <>
            <p className={shareStyles.error} role="alert">
              {t('sharing.dialog.enableFailed')}
            </p>
            <button type="button" className={shareStyles.secondaryBtn} onClick={requestLink}>
              {t('sharing.dialog.retry')}
            </button>
          </>
        )}
        {!needsName && link === null && !failed && (
          <p className={shareStyles.placeholder} role="status">
            {t('sharing.dialog.preparing')}
          </p>
        )}
      </div>
    </>
  );
}

interface IListLinkStepProps {
  readonly list: ICardList;
  readonly link: IListLinkState;
  readonly onTurnedOff: () => void;
}

function ListLinkStep({ list, link, onTurnedOff }: IListLinkStepProps): React.ReactElement {
  const { t } = useTranslation();
  const disable = useDisableListShareMutation(list.id);
  const setContact = useSetListShareContactMutation(list.id);

  const { user } = useAuth();
  const translate = makeTranslate(t);
  const url = versionedListUrl(list, link.url, translate);
  const contact = (
    <ShareContactRow
      testId="list-share-contact"
      showContact={link.showContact}
      updating={setContact.isPending}
      warnWithoutNumber
      onToggle={(next, onFailed) => setContact.mutate(next, { onError: onFailed })}
    />
  );
  // Without a number the page cannot be answered: that warning leads, before the address and the send button.
  const warnFirst = user?.whatsappNumber == null;

  return (
    <>
      {warnFirst && contact}
      <ShareAddressRow url={url} />
      <ShareWhatsappButton message={buildListShareMessage(list, url, translate)} />
      {!warnFirst && contact}
      <ShareLinkFooter
        downloadHref={sharedListImageDownloadPath(link.token)}
        downloadLabel={t('lists.share.downloadImage')}
        turningOff={disable.isPending}
        turnOffFailed={disable.isError}
        onTurnOff={() => disable.mutate(undefined, { onSuccess: onTurnedOff })}
      />
    </>
  );
}
