import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient } from '../lib/api-client';
import { DECKS_QUERY_KEY } from './decks';
import type { IAlternativeImageUrl } from './replacements';

export const CHAT_TURN_FAILURE_CODES = [
  'BUDGET_EXHAUSTED',
  'NO_API_KEY',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'MODEL_TIMEOUT',
  'TURN_TIMEOUT',
  'MODEL_REFUSED',
  'MODEL_TRUNCATED',
  'MODEL_BAD_TOOL_CALL',
  'TOO_MANY_TOOL_ROUNDS',
  'HISTORY_REJECTED',
  'MODEL_EMPTY',
  'WORKER_LOST',
] as const;
export type TChatTurnFailureCode = (typeof CHAT_TURN_FAILURE_CODES)[number];

export const CHAT_POLL_MS = 3_000;
export const MESSAGE_MAX_LENGTH = 4_000;

export type TChatMessageStatus = 'pending' | 'running' | 'done' | 'failed';
export type TProposalStatus = 'pending' | 'applied' | 'dismissed' | 'stale';

export interface IChatConversationSummary {
  readonly id: string;
  readonly title: string | null;
  readonly trackedDeckId: number | null;
  readonly updatedAt: string;
}

export interface IChatCardLabel {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
}

export interface IDeckProposalDisplay {
  readonly heroName: string;
  readonly cards: readonly (IChatCardLabel & { readonly quantity: number; readonly slot: string; readonly ownedQuantity: number })[];
}

type TSwapCardLabel = IChatCardLabel & { readonly imageUrl: IAlternativeImageUrl | null };

export interface ISwapProposalDisplay {
  readonly original: TSwapCardLabel & { readonly copiesInDeck: number };
  readonly replacement: TSwapCardLabel & { readonly freeCopies: number };
}

interface IProposalBase {
  readonly id: string;
  readonly status: TProposalStatus;
  readonly reason: string;
  readonly ownedCount: number;
  readonly missingCount: number;
  readonly trackedDeckId: number | null;
  readonly cardReplacementId: string | null;
  readonly replacementStatus: 'active' | 'kept' | 'reverted' | 'removed' | null;
}

export interface IDeckProposal extends IProposalBase {
  readonly kind: 'deck';
  readonly payload: { readonly name: string; readonly heroIdentifier: string; readonly format: string };
  readonly display: IDeckProposalDisplay;
}

export interface ISwapProposal extends IProposalBase {
  readonly kind: 'swap';
  readonly payload: { readonly trackedDeckId: number; readonly slot: string };
  readonly display: ISwapProposalDisplay;
}

export type TChatProposal = IDeckProposal | ISwapProposal;

export interface IChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly status: TChatMessageStatus;
  readonly text: string | null;
  readonly error: TChatTurnFailureCode | null;
  readonly proposals: readonly TChatProposal[];
  readonly createdAt: string;
}

export interface IChatConversation extends IChatConversationSummary {
  readonly messages: readonly IChatMessage[];
}

export interface IChatUsage {
  readonly spentUsd: number;
  readonly budgetUsd: number;
  readonly resetsAt: string;
}

export const CHAT_CONVERSATIONS_QUERY_KEY = ['chat', 'conversations'] as const;
export const CHAT_USAGE_QUERY_KEY = ['chat', 'usage'] as const;

export function chatConversationQueryKey(conversationId: string) {
  return ['chat', 'conversation', conversationId] as const;
}

// The id comes from the URL; unencoded, `..%2F` segments would reach other API routes with the user's token.
export function conversationPath(conversationId: string): string {
  return `/chat/conversations/${encodeURIComponent(conversationId)}`;
}

export function lastAssistantMessage(conversation: IChatConversation | undefined): IChatMessage | null {
  return [...(conversation?.messages ?? [])].reverse().find((message) => message.role === 'assistant') ?? null;
}

export function isTurnOpen(conversation: IChatConversation | undefined): boolean {
  const last = lastAssistantMessage(conversation);
  return last?.status === 'pending' || last?.status === 'running';
}

export function chatRefetchInterval(conversation: IChatConversation | undefined): number | false {
  return isTurnOpen(conversation) ? CHAT_POLL_MS : false;
}

export function readApiError(error: unknown): { readonly code: string | null; readonly resetsAt: string | null } {
  if (!(error instanceof ApiError)) return { code: null, resetsAt: null };
  try {
    const body = JSON.parse(error.message) as { code?: unknown; details?: { resetsAt?: unknown } };
    return {
      code: typeof body.code === 'string' ? body.code : null,
      resetsAt: typeof body.details?.resetsAt === 'string' ? body.details.resetsAt : null,
    };
  } catch {
    return { code: null, resetsAt: null };
  }
}

export function useChatConversationsQuery(enabled = true) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: CHAT_CONVERSATIONS_QUERY_KEY,
    queryFn: () => apiFetch<IChatConversationSummary[]>('/chat/conversations'),
    enabled,
  });
}

export function useChatConversationQuery(conversationId: string | null) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: chatConversationQueryKey(conversationId ?? ''),
    queryFn: () => apiFetch<IChatConversation>(conversationPath(conversationId ?? '')),
    enabled: conversationId !== null,
    retry: false,
    refetchInterval: (query) => chatRefetchInterval(query.state.data),
  });
}

export function useChatUsageQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: CHAT_USAGE_QUERY_KEY,
    queryFn: () => apiFetch<IChatUsage>('/chat/usage'),
  });
}

export class FirstMessageError extends Error {
  constructor(
    public readonly conversationId: string,
    public override readonly cause: unknown,
  ) {
    super('first message refused');
    this.name = 'FirstMessageError';
  }
}

export function useStartConversation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, trackedDeckId }: { readonly text: string; readonly trackedDeckId: number | null }) => {
      const { id } = await apiFetch<{ id: string }>('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(trackedDeckId === null ? {} : { trackedDeckId }),
      });
      try {
        await apiFetch(`${conversationPath(id)}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
      } catch (error) {
        throw new FirstMessageError(id, error);
      }
      return { id };
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_QUERY_KEY }),
  });
}

function useRefreshConversation(conversationId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: chatConversationQueryKey(conversationId) });
    void queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_QUERY_KEY });
  };
}

export function useSendMessage(conversationId: string) {
  const apiFetch = useApiClient();
  const refresh = useRefreshConversation(conversationId);
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<{ userMessageId: string; assistantMessageId: string }>(`${conversationPath(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    onSuccess: refresh,
  });
}

export function useRetryMessage(conversationId: string) {
  const apiFetch = useApiClient();
  const refresh = useRefreshConversation(conversationId);
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch<{ assistantMessageId: string }>(`${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

export function useDeleteConversation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => apiFetch<void>(conversationPath(conversationId), { method: 'DELETE' }),
    onSuccess: (_result, conversationId) => {
      queryClient.setQueryData<IChatConversationSummary[]>(CHAT_CONVERSATIONS_QUERY_KEY, (current) =>
        current?.filter((conversation) => conversation.id !== conversationId),
      );
      queryClient.removeQueries({ queryKey: chatConversationQueryKey(conversationId) });
    },
  });
}

export function useDecideProposal(conversationId: string, decision: 'apply' | 'dismiss') {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshConversation(conversationId);
  return useMutation({
    mutationFn: (proposalId: string) => apiFetch<unknown>(`/chat/proposals/${encodeURIComponent(proposalId)}/${decision}`, { method: 'POST' }),
    onSuccess: async () => {
      if (decision === 'apply') void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      await refresh();
    },
    onError: refresh,
  });
}

export function useUndoSwap(conversationId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshConversation(conversationId);
  return useMutation({
    mutationFn: (replacementId: string) => apiFetch<unknown>(`/replacements/${encodeURIComponent(replacementId)}/revert`, { method: 'POST' }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      await refresh();
    },
    onError: refresh,
  });
}
