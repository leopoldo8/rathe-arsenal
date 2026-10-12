import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDeleteConversation, type IChatConversationSummary } from '../../api/chat';
import { formatRelativeTime } from '../../utils/format-relative-time';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { DeckChip } from './DeckChip';
import styles from './ConversationList.module.css';

interface IConversationListProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly conversations: readonly IChatConversationSummary[];
  readonly currentId: string | null;
  readonly deckNames: ReadonlyMap<number, string>;
}

function TrashIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function ConversationList({ open, onOpenChange, conversations, currentId, deckNames }: IConversationListProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteConversation();
  const [pendingDelete, setPendingDelete] = useState<IChatConversationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ordered = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const titleOf = (conversation: IChatConversationSummary) => conversation.title ?? t('chat.untitled');

  function openConversation(conversationId: string): void {
    onOpenChange(false);
    void navigate({ to: '/chat/$conversationId', params: { conversationId } });
  }

  function confirmDelete(): void {
    if (pendingDelete === null) return;
    const deletedId = pendingDelete.id;
    setPendingDelete(null);
    setError(null);
    remove.mutate(deletedId, {
      onSuccess: () => {
        if (deletedId === currentId) {
          onOpenChange(false);
          void navigate({ to: '/chat' });
        }
      },
      onError: (cause) => setError(localizeApiError(cause, t)),
    });
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.panel} aria-describedby={undefined} data-testid="conversation-list">
            <span className={styles.grip} aria-hidden="true" />
            <div className={styles.header}>
              <Dialog.Title className={styles.title}>{t('chat.listTitle')}</Dialog.Title>
              <Link to="/chat" search={{}} className={styles.new} onClick={() => onOpenChange(false)}>
                {t('chat.newConversation')}
              </Link>
              <Dialog.Close className={styles.close} aria-label={t('chat.close')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </Dialog.Close>
            </div>
            {error !== null && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {ordered.length === 0 ? (
              <p className={styles.empty}>{t('chat.listEmpty')}</p>
            ) : (
              <ul className={styles.list}>
                {ordered.map((conversation) => {
                  const deckName = conversation.trackedDeckId === null ? undefined : deckNames.get(conversation.trackedDeckId);
                  const current = conversation.id === currentId;
                  return (
                    <li key={conversation.id} className={styles.row} data-current={current ? 'true' : undefined} data-testid="conversation-row">
                      <button
                        type="button"
                        className={styles.open}
                        aria-current={current ? 'true' : undefined}
                        onClick={() => openConversation(conversation.id)}
                        data-testid="conversation-open"
                      >
                        <span className={styles.rowTitle} data-testid="conversation-title">
                          {titleOf(conversation)}
                        </span>
                        <span className={styles.rowTime} data-testid="conversation-time">
                          {formatRelativeTime(conversation.updatedAt, t)}
                        </span>
                      </button>
                      {deckName !== undefined && conversation.trackedDeckId !== null && (
                        <span className={styles.rowChip}>
                          <DeckChip deckId={conversation.trackedDeckId} name={deckName} />
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.delete}
                        aria-label={t('chat.deleteAria', { title: titleOf(conversation) })}
                        onClick={() => setPendingDelete(conversation)}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={pendingDelete !== null} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.confirmOverlay} />
          <AlertDialog.Content className={styles.confirm}>
            <AlertDialog.Title className={styles.confirmTitle}>{t('chat.deleteTitle')}</AlertDialog.Title>
            <AlertDialog.Description className={styles.confirmBody}>{t('chat.deleteBody')}</AlertDialog.Description>
            <div className={styles.confirmActions}>
              <AlertDialog.Cancel className={styles.cancel}>{t('chat.deleteCancel')}</AlertDialog.Cancel>
              <AlertDialog.Action className={styles.danger} onClick={confirmDelete}>
                {t('chat.deleteConfirm')}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
