import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IChatConversationSummary } from '../../api/chat';
import { ConversationRows } from './ConversationRows';
import styles from './ConversationList.module.css';

interface IConversationListProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly conversations: readonly IChatConversationSummary[];
  readonly currentId: string | null;
  readonly deckNames: ReadonlyMap<number, string>;
}

export function ConversationList({ open, onOpenChange, conversations, currentId, deckNames }: IConversationListProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function openConversation(conversationId: string): void {
    onOpenChange(false);
    void navigate({ to: '/chat/$conversationId', params: { conversationId } });
  }

  function leaveDeleted(): void {
    onOpenChange(false);
    void navigate({ to: '/chat' });
  }

  return (
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
          <ConversationRows
            conversations={conversations}
            currentId={currentId}
            deckNames={deckNames}
            onOpen={openConversation}
            onCurrentDeleted={leaveDeleted}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
