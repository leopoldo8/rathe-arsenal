import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DECKS_QUERY_KEY } from '../api/decks';
import { useApiClient } from '../lib/api-client';
import { useToast } from '../components/ui/Toast/useToast';

export interface IDeletableDeck {
  readonly id: number;
  readonly name: string;
}

/**
 * Deletes a deck at once (it moves to "Excluídos recentemente") and leaves a toast with "Desfazer" on
 * screen until the player's next action. The delete is already recorded when the toast shows, so leaving
 * the page changes nothing. Resolves true when the deck was deleted.
 */
export function useDeleteDeckWithUndo(): (deck: IDeletableDeck) => Promise<boolean> {
  const { t } = useTranslation();
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const { show } = useToast();

  return useCallback(
    async (deck) => {
      const refresh = (): void => {
        void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      };
      try {
        await apiFetch<unknown>(`/decks/${deck.id}`, { method: 'DELETE' });
      } catch {
        show({ kind: 'error', message: t('home.untrackFailed') });
        return false;
      }
      refresh();
      show({
        kind: 'info',
        message: t('home.untrackToastMsg', { deckName: deck.name }),
        persistent: true,
        dismissOnNextAction: true,
        action: {
          label: t('home.undoUntrack'),
          onClick: () => {
            apiFetch<unknown>(`/decks/${deck.id}/restore`, { method: 'POST' })
              .catch(() => show({ kind: 'error', message: t('home.restoreFailed') }))
              .finally(refresh);
          },
        },
      });
      return true;
    },
    [apiFetch, queryClient, show, t],
  );
}
