import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ISearchCardResult } from '../../api/catalog';
import { useAddCardMutation } from '../../api/collection';
import { LIBRARY_QUERY_KEY } from '../../api/library';
import { DeckCardSearchAutocomplete, type TDeckSlot } from '../deck-card-search/DeckCardSearchAutocomplete';
import styles from './LibrarySearchAddBar.module.css';

interface ILibrarySearchAddBarProps {
  /** Ref forwarded to the underlying input so external callers can focus it
   * (e.g. LibraryEmptyState "Search and add a card" CTA). */
  readonly inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Called after a card is successfully added — parent may show a toast. */
  readonly onAdded?: (cardName: string) => void;
}

/**
 * LibrarySearchAddBar — thin wrapper around DeckCardSearchAutocomplete that
 * hard-codes the slot picker to hidden (Library doesn't need a slot) and
 * supplies an onPick handler that invokes useAddCardMutation and invalidates
 * LIBRARY_QUERY_KEY. All ARIA logic, debounce, and keyboard handling live
 * in DeckCardSearchAutocomplete.
 */
export function LibrarySearchAddBar({
  inputRef,
  onAdded,
}: ILibrarySearchAddBarProps): React.ReactElement {
  const queryClient = useQueryClient();
  const addCardMutation = useAddCardMutation();

  const handlePick = useCallback(
    (card: ISearchCardResult, _slot: TDeckSlot) => {
      addCardMutation.mutate(
        { cardIdentifier: card.cardIdentifier, quantity: 1 },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: ['decks'] });
            void queryClient.invalidateQueries({ queryKey: ['deck-detail'] });
            onAdded?.(card.name);
          },
        },
      );
    },
    [addCardMutation, queryClient, onAdded],
  );

  return (
    <>
      <DeckCardSearchAutocomplete
        onPick={handlePick}
        label="Search and add cards to your library"
        showSlotPicker={false}
        {...(inputRef ? { inputRef } : {})}
      />
      {addCardMutation.isError ? (
        <div role="alert" className={styles.errorMsg}>
          Failed to add card. Please try again.
        </div>
      ) : null}
    </>
  );
}
