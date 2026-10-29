import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useChatConversationsQuery } from '../../../api/chat';
import type { IDeckLegality } from '../../../api/decks';
import { TutorMark } from '../../chat/TutorMark';
import { useAskTutor } from '../../chat/useAskTutor';
import { firstTutorQuestion } from './tutorTileQuestion';
import styles from './DeckTutorTile.module.css';

interface IDeckTutorTileProps {
  readonly deckId: number;
  readonly heroName: string;
  /** The deck's verdict; with it the first question follows the deck's state. */
  readonly legality?: Pick<IDeckLegality, 'details'> | null | undefined;
  readonly format?: string;
}

export function DeckTutorTile({ deckId, heroName, legality, format }: IDeckTutorTileProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversations = useChatConversationsQuery();
  const { ask, pending, error } = useAskTutor(deckId);
  const bound = (conversations.data ?? [])
    .filter((conversation) => conversation.trackedDeckId === deckId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const questions = [firstTutorQuestion({ legality, format, heroName, t }), t('chat.tile.readySwap'), t('chat.tile.readyMissing')];

  return (
    <li className={styles.tile} data-testid="tutor-tile">
      <span className={styles.title}>
        <TutorMark size={16} />
        <span>{t('chat.tile.title')}</span>
      </span>
      <ul className={styles.questions}>
        {questions.map((question) => (
          <li key={question}>
            <button type="button" className={styles.question} disabled={pending} onClick={() => ask(question)} data-testid="tile-question">
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
