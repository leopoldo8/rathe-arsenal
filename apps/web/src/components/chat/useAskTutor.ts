import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FirstMessageError, useStartConversation } from '../../api/chat';
import { localizeApiError } from '../card-scanner/localize-api-error';

/** Opens the Tutor bound to one deck with a question already sent; a refusal is told in `error`. */
export function useAskTutor(deckId: number): { readonly ask: (text: string) => void; readonly pending: boolean; readonly error: string | null } {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = useStartConversation();
  const [error, setError] = useState<string | null>(null);

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

  return { ask, pending: start.isPending, error };
}
