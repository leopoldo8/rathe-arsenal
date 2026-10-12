import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FirstMessageError, useChatConversationsQuery, useStartConversation } from '../../../api/chat';
import { localizeApiError } from '../../card-scanner/localize-api-error';
import { TutorMark } from '../../chat/TutorMark';
import styles from './DeckTutorTile.module.css';

interface IDeckTutorTileProps {
  readonly deckId: number;
  readonly heroName: string;
}

export function DeckTutorTile({ deckId, heroName }: IDeckTutorTileProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversations = useChatConversationsQuery();
  const start = useStartConversation();
  const [error, setError] = useState<string | null>(null);
  const bound = (conversations.data ?? [])
    .filter((conversation) => conversation.trackedDeckId === deckId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const questions = [t('chat.tile.readyHero', { hero: heroName }), t('chat.tile.readySwap'), t('chat.tile.readyMissing')];

  function ask(text: string): void {
    setError(null);
    start.mutate(
      { text, trackedDeckId: deckId },
      {
        onSuccess: ({ id }) => void navigate({ to: '/chat/$conversationId', params: { conversationId: id } }),
        onError: (cause) => {
          if (cause instanceof FirstMessageError) {
            void navigate({ to: '/chat/$conversationId', params: { conversationId: cause.conversationId } });
            return;
          }
          setError(localizeApiError(cause, t));
        },
      },
    );
  }

  return (
    <li className={styles.tile} data-testid="tutor-tile">
      <span className={styles.title}>
        <TutorMark size={16} />
        <span>{t('chat.tile.title')}</span>
      </span>
      <ul className={styles.questions}>
        {questions.map((question) => (
          <li key={question}>
            <button type="button" className={styles.question} disabled={start.isPending} onClick={() => ask(question)} data-testid="tile-question">
              {question}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.start}
        onClick={() => void navigate({ to: '/chat', search: { deck: deckId } })}
      >
        <TutorMark size={16} />
        <span>{t('chat.tile.start')}</span>
      </button>
      {bound[0] !== undefined && (
        <Link to="/chat/$conversationId" params={{ conversationId: bound[0].id }} className={styles.count} data-testid="tile-count">
          {t('chat.tile.count', { count: bound.length })}
        </Link>
      )}
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </li>
  );
}
