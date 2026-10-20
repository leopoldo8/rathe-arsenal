import type { IChatConversationSummary } from '../../api/chat';

export type TConversationAge = 'groupToday' | 'groupWeek' | 'groupOlder';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function ageOf(updatedAt: string, now: Date): TConversationAge {
  const updated = new Date(updatedAt);
  if (updated.toDateString() === now.toDateString()) return 'groupToday';
  return now.getTime() - updated.getTime() < WEEK_MS ? 'groupWeek' : 'groupOlder';
}

export function groupByAge(
  conversations: readonly IChatConversationSummary[],
  now: Date,
): readonly { readonly age: TConversationAge; readonly conversations: readonly IChatConversationSummary[] }[] {
  const ordered = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (['groupToday', 'groupWeek', 'groupOlder'] as const)
    .map((age) => ({ age, conversations: ordered.filter((conversation) => ageOf(conversation.updatedAt, now) === age) }))
    .filter((group) => group.conversations.length > 0);
}
