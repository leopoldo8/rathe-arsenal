import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChatScreen } from '../../components/chat/ChatScreen';
import { ChatGate } from './-chat-gate';

export const Route = createFileRoute('/_auth/chat/$conversationId')({
  component: ChatConversationPage,
});

function ChatConversationPage(): React.ReactElement {
  const { conversationId } = Route.useParams();
  return (
    <ChatGate>
      <ChatScreen key={conversationId} conversationId={conversationId} draftDeckId={null} />
    </ChatGate>
  );
}
