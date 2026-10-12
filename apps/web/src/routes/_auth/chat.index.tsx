import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChatScreen } from '../../components/chat/ChatScreen';
import { ChatGate } from './-chat-gate';

interface IChatSearch {
  readonly deck?: number;
}

function validateChatSearch(raw: Record<string, unknown>): IChatSearch {
  const deck = typeof raw.deck === 'string' ? Number(raw.deck) : raw.deck;
  return typeof deck === 'number' && Number.isInteger(deck) && deck > 0 ? { deck } : {};
}

export const Route = createFileRoute('/_auth/chat/')({
  validateSearch: validateChatSearch,
  component: NewChatPage,
});

function NewChatPage(): React.ReactElement {
  const { deck } = Route.useSearch();
  return (
    <ChatGate>
      <ChatScreen key={deck ?? 'unbound'} conversationId={null} draftDeckId={deck ?? null} />
    </ChatGate>
  );
}
