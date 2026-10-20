import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IChatConversation, IChatConversationSummary } from '../../api/chat';
import { ConversationRows } from './ConversationRows';
import { DeckChip } from './DeckChip';
import styles from './ConversationSidebar.module.css';

interface IConversationSidebarProps {
  readonly conversations: readonly IChatConversationSummary[];
  readonly conversation: IChatConversation | undefined;
  readonly currentId: string | null;
  readonly deckNames: ReadonlyMap<number, string>;
  readonly boundDeckId: number | null;
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ConversationSidebar({ conversations, conversation, currentId, deckNames, boundDeckId }: IConversationSidebarProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const boundDeckName = boundDeckId === null ? undefined : deckNames.get(boundDeckId);
  const messages = conversation?.messages ?? [];
  const questions = messages.filter((message) => message.role === 'user').length;
  const proposals = messages.reduce((sum, message) => sum + message.proposals.length, 0);

  return (
    <aside className={styles.sidebar} aria-label={t('chat.listTitle')}>
      <Link to="/chat" search={{}} className={styles.new}>
        <PlusIcon />
        <span>{t('chat.newConversationLong')}</span>
      </Link>
      <section className={styles.open} data-testid="open-conversation">
        <p className={styles.caption}>{t('chat.openConversation')}</p>
        <h1 className={styles.title}>{conversation?.title ?? t('chat.newTitle')}</h1>
        {boundDeckId !== null && boundDeckName !== undefined && <DeckChip deckId={boundDeckId} name={boundDeckName} />}
        {questions > 0 && (
          <p className={styles.stats}>
            {t('chat.questionCount', { count: questions })} · {t('chat.proposalCount', { count: proposals })}
          </p>
        )}
      </section>
      <p className={styles.caption}>{t('chat.listTitle')}</p>
      <div className={styles.list}>
        <ConversationRows
          conversations={conversations}
          currentId={currentId}
          deckNames={deckNames}
          onOpen={(conversationId) => void navigate({ to: '/chat/$conversationId', params: { conversationId } })}
          onCurrentDeleted={() => void navigate({ to: '/chat' })}
        />
      </div>
    </aside>
  );
}
