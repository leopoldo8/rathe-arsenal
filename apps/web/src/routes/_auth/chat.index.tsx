import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChatScreen } from '../../components/chat/ChatScreen';
import { ChatGate } from './-chat-gate';
import { validateChatSearch } from './-chat-search';

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
