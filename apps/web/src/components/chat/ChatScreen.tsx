import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CHAT_USAGE_QUERY_KEY,
  FirstMessageError,
  isTurnOpen,
  lastAssistantMessage,
  readApiError,
  useChatConversationQuery,
  useChatConversationsQuery,
  useChatUsageQuery,
  useRetryMessage,
  useSendMessage,
  useStartConversation,
} from '../../api/chat';
import { useDecksQuery } from '../../api/decks';
import { ApiError } from '../../lib/api-client';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { ChatThread } from './ChatThread';
import { Composer } from './Composer';
import { ConversationList } from './ConversationList';
import { DeckChip } from './DeckChip';
import { failureOutcome } from './chat-failure';
import { keepComposerDraft, takeComposerDraft } from './composer-drafts';
import { TutorMark } from './TutorMark';
import styles from './ChatScreen.module.css';

const NOT_FOUND_STATUSES = new Set([400, 404]);

interface IChatScreenProps {
  readonly conversationId: string | null;
  readonly draftDeckId: number | null;
}

function startOfNextUtcMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function ListIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChatScreen({ conversationId, draftDeckId }: IChatScreenProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const conversations = useChatConversationsQuery();
  const thread = useChatConversationQuery(conversationId);
  const usage = useChatUsageQuery();
  const decks = useDecksQuery();
  const start = useStartConversation();
  const send = useSendMessage(conversationId ?? '');
  const retry = useRetryMessage(conversationId ?? '');
  const [handedOver] = useState(() => takeComposerDraft(conversationId));
  const [text, setText] = useState(handedOver?.text ?? '');
  const [error, setError] = useState<string | null>(handedOver?.error || null);
  const [refusedUntil, setRefusedUntil] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const deckList = useMemo(() => decks.data?.trackedDecks ?? [], [decks.data]);
  const deckNames = useMemo(() => new Map(deckList.map((deck) => [deck.id, deck.name])), [deckList]);
  const latestHero = useMemo(() => [...deckList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.hero ?? null, [deckList]);

  const conversation = thread.data;
  const boundDeckId = conversationId === null ? draftDeckId : (conversation?.trackedDeckId ?? null);
  const boundDeckName = boundDeckId === null ? undefined : deckNames.get(boundDeckId);
  const lastAnswer = lastAssistantMessage(conversation);
  const turnOpen = isTurnOpen(conversation);
  const usageAtCap = usage.data !== undefined && usage.data.spentUsd >= usage.data.budgetUsd;
  const turnRefused = lastAnswer?.status === 'failed' && failureOutcome(lastAnswer.error) === 'limit';
  const resetsAt = usage.data?.resetsAt ?? startOfNextUtcMonth(new Date());
  const limitResetsAt = refusedUntil ?? (usageAtCap || turnRefused ? resetsAt : null);
  const busy = start.isPending || send.isPending;
  const readError = thread.error;
  const notFound = readError instanceof ApiError && NOT_FOUND_STATUSES.has(readError.status);
  const showEmpty = conversationId === null || (conversation !== undefined && conversation.messages.length === 0);

  const readyQuestions = [
    ...(latestHero !== null ? [t('chat.readyHero', { hero: latestHero })] : []),
    t('chat.readyNextHero'),
    t('chat.readyTriggers'),
  ];

  function sendErrorCopy(cause: unknown): string | null {
    const { code, resetsAt: refusedResetsAt } = readApiError(cause);
    if (code === 'CHAT_BUDGET_EXHAUSTED') {
      setRefusedUntil(refusedResetsAt ?? resetsAt);
      void queryClient.invalidateQueries({ queryKey: CHAT_USAGE_QUERY_KEY });
      return null;
    }
    return localizeApiError(cause, t);
  }

  function openConversation(id: string): void {
    void navigate({ to: '/chat/$conversationId', params: { conversationId: id } });
  }

  function handleSend(value: string): void {
    setError(null);
    if (conversationId === null) {
      start.mutate(
        { text: value, trackedDeckId: draftDeckId },
        {
          onSuccess: ({ id }) => {
            setText('');
            openConversation(id);
          },
          onError: (cause) => {
            if (cause instanceof FirstMessageError) {
              keepComposerDraft(cause.conversationId, { text: value, error: sendErrorCopy(cause.cause) ?? '' });
              openConversation(cause.conversationId);
              return;
            }
            setText(value);
            setError(sendErrorCopy(cause));
          },
        },
      );
      return;
    }
    send.mutate(value, {
      onSuccess: () => setText(''),
      onError: (cause) => setError(sendErrorCopy(cause)),
    });
  }

  function handleRetry(messageId: string): void {
    setError(null);
    retry.mutate(messageId, { onError: (cause) => setError(sendErrorCopy(cause)) });
  }

  const placeholder = limitResetsAt !== null ? t('chat.composerLimit') : turnOpen ? t('chat.composerWaiting') : t('chat.composerPlaceholder');
  const resetDate = limitResetsAt === null ? '' : new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(limitResetsAt));

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.brand} aria-hidden="true">
            <TutorMark size={18} />
          </span>
          <h1 className={styles.title}>{conversation?.title ?? t('chat.newTitle')}</h1>
          {boundDeckId !== null && boundDeckName !== undefined && (
            <span className={styles.headerChip}>
              <DeckChip deckId={boundDeckId} name={boundDeckName} />
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.listButton} onClick={() => setListOpen(true)}>
            <ListIcon />
            <span className={styles.listLabel}>{t('chat.conversations')}</span>
            <span className={styles.count} data-testid="conversation-count">
              {conversations.data?.length ?? 0}
            </span>
          </button>
          <Link to="/chat" className={styles.newButton}>
            <PlusIcon />
            <span>{t('chat.newConversation')}</span>
          </Link>
        </div>
      </header>

      <div className={styles.column}>
        {conversationId !== null && thread.isPending && (
          <div className={styles.skeleton} data-testid="chat-thread-skeleton" aria-hidden="true">
            <span className={styles.skeletonBubble} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
          </div>
        )}

        {notFound && (
          <div className={styles.notice} role="alert">
            <p>{t('chat.notFound')}</p>
            <Link to="/chat" className={styles.noticeAction}>
              {t('chat.startNew')}
            </Link>
          </div>
        )}

        {readError !== null && !notFound && (
          <div className={styles.notice} role="alert">
            <p>{t('chat.loadError')}</p>
            <button type="button" className={styles.noticeAction} onClick={() => void thread.refetch()}>
              {t('chat.retry')}
            </button>
          </div>
        )}

        {showEmpty && !notFound && readError === null && (
          <section className={styles.empty}>
            <span className={styles.emptyMark}>
              <TutorMark size={32} />
            </span>
            <h2 className={styles.emptyHeading}>{t('chat.emptyHeading')}</h2>
            <p className={styles.emptyIntro}>{t('chat.emptyIntro')}</p>
            <ul className={styles.ready} aria-label={t('chat.readyAria')}>
              {readyQuestions.map((question) => (
                <li key={question}>
                  <button type="button" className={styles.readyButton} disabled={busy || limitResetsAt !== null} onClick={() => handleSend(question)} data-testid="ready-question">
                    <span>{question}</span>
                    <ArrowIcon />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {conversation !== undefined && conversationId !== null && conversation.messages.length > 0 && (
          <ChatThread conversationId={conversationId} messages={conversation.messages} onRetry={handleRetry} retrying={retry.isPending} />
        )}

        {limitResetsAt !== null && (
          <div className={styles.limit} role="status">
            <p className={styles.limitTitle}>{t('chat.limitTitle')}</p>
            <p className={styles.limitBody}>{t('chat.limitBody', { date: resetDate })}</p>
            {turnRefused && !usageAtCap && refusedUntil === null && lastAnswer !== null && (
              <button type="button" className={styles.noticeAction} onClick={() => handleRetry(lastAnswer.id)} disabled={retry.isPending}>
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}

        <div className={styles.composer}>
          <Composer
            value={text}
            onChange={setText}
            onSend={handleSend}
            placeholder={placeholder}
            disabled={busy || turnOpen || limitResetsAt !== null || notFound}
            error={error}
          />
        </div>
      </div>

      <ConversationList
        open={listOpen}
        onOpenChange={setListOpen}
        conversations={conversations.data ?? []}
        currentId={conversationId}
        deckNames={deckNames}
      />
    </div>
  );
}
