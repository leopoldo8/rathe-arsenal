import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import {
  deckDetailQueryKey,
  IBreakdown,
  ISubstitutionMatch,
  TPath,
} from './deck-detail';

export interface IReSolveResult {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TPath;
  readonly fidelityPercent: number;
  readonly breakdown: IBreakdown;
  readonly substitutions: readonly ISubstitutionMatch[];
  readonly rejectionCount: number;
  readonly curveWarnings: readonly string[];
}

/**
 * Reject a single substitute for a tracked deck. The rejection is
 * persisted and the re-solved snapshot becomes the new latest.
 */
export function useRejectSubstituteMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<IReSolveResult>(`/decks/${deckId}/reject-substitute`, {
        method: 'POST',
        body: JSON.stringify({ cardIdentifier }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Wipe all persisted rejections for a tracked deck and recompute the
 * untouched snapshot.
 */
export function useResetRejectionsMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<IReSolveResult>(`/decks/${deckId}/reset-rejections`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Dry-run re-solve used by the test result screen (U6) to preview a
 * re-solve result without persisting the exclusions.
 */
export function useReSolveMutation(deckId: string) {
  const apiFetch = useApiClient();
  return useMutation({
    mutationFn: (excludedCardIdentifiers: readonly string[]) =>
      apiFetch<IReSolveResult>(`/decks/${deckId}/re-solve`, {
        method: 'POST',
        body: JSON.stringify({ excludedCardIdentifiers }),
      }),
  });
}
