import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IChatMessage } from '../../api/chat';
import { AnswerMarkdown } from './AnswerMarkdown';
import { failureOutcome } from './chat-failure';
import { ProposalCard } from './ProposalCard';
import { TutorMark } from './TutorMark';
import styles from './ChatThread.module.css';

const SECOND_MS = 1_000;

interface IChatThreadProps {
  readonly conversationId: string;
  readonly messages: readonly IChatMessage[];
  readonly onRetry: (messageId: string) => void;
  readonly retrying: boolean;
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

function AnswerLabel(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <span className={styles.label}>
      <TutorMark size={16} />
      <span data-testid="answer-label">{t('chat.answerLabel')}</span>
    </span>
  );
}

function Waiting({ createdAt, now }: { readonly createdAt: string; readonly now: number }): React.ReactElement {
  const { t } = useTranslation();
  const seconds = Math.max(0, Math.floor((now - Date.parse(createdAt)) / SECOND_MS));
  return (
    <div className={styles.waiting} role="status">
      <p className={styles.waitingLine}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.waitingWord}>{t('chat.waiting')}</span>
        <span className={styles.elapsed}>{t('chat.waitingElapsed', { seconds })}</span>
      </p>
      <p className={styles.hint}>{t('chat.waitingHint')}</p>
    </div>
  );
}

function RetryIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  );
}

function Failure({ message, onRetry, retrying }: { readonly message: IChatMessage; readonly onRetry: () => void; readonly retrying: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const outcome = failureOutcome(message.error) === 'timeout' ? 'timeout' : 'generic';
  return (
    <div className={styles.failure} role="alert">
      <p className={styles.failureTitle}>{t('chat.failureTitle')}</p>
      <p className={styles.failureBody}>{t(`chat.failure.${outcome}`)}</p>
      <button type="button" className={styles.retry} onClick={onRetry} disabled={retrying}>
        <RetryIcon />
        <span>{t('chat.retry')}</span>
      </button>
    </div>
  );
}

export function ChatThread({ conversationId, messages, onRetry, retrying }: IChatThreadProps): React.ReactElement {
  const { t } = useTranslation();
  const open = messages.some((message) => message.role === 'assistant' && (message.status === 'pending' || message.status === 'running'));
  const now = useNow(open);
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <ol className={styles.thread} aria-label={t('chat.threadAria')}>
      {ordered.map((message) => {
        if (message.role === 'user') {
          return (
            <li key={message.id} className={styles.user} data-role="user" data-testid="chat-message">
              <p className={styles.bubble}>{message.text}</p>
            </li>
          );
        }
        const budgetFailure = message.status === 'failed' && failureOutcome(message.error) === 'limit';
        if (budgetFailure) return null;
        return (
          <li key={message.id} className={styles.assistant} data-role="assistant" data-testid="chat-message">
            <AnswerLabel />
            {(message.status === 'pending' || message.status === 'running') && <Waiting createdAt={message.createdAt} now={now} />}
            {message.status === 'failed' && <Failure message={message} onRetry={() => onRetry(message.id)} retrying={retrying} />}
            {message.status === 'done' && message.text !== null && <AnswerMarkdown text={message.text} />}
            {message.status === 'done' &&
              message.proposals.map((proposal) => <ProposalCard key={proposal.id} conversationId={conversationId} proposal={proposal} />)}
          </li>
        );
      })}
    </ol>
  );
}
