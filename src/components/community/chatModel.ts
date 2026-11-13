/** Client-only filter for conversations already returned by the authenticated API. */
export type ConversationSummary = {
  id: string;
  title?: string | null;
  is_group?: boolean;
  peer_name?: string | null;
};

export function conversationDisplayTitle(conversation?: ConversationSummary | null): string {
  if (!conversation) return "Оберіть розмову";
  if (conversation.is_group) return conversation.title?.trim() || "Групова розмова";
  // A one-to-one dialogue must be named after the other participant for each viewer.
  return conversation.peer_name?.trim() || conversation.title?.trim() || "Особистий діалог";
}

export function filterConversations<T extends ConversationSummary>(
  conversations: T[],
  search: string,
): T[] {
  const normalized = search.trim().toLocaleLowerCase("uk-UA");
  if (!normalized) return conversations;
  return conversations.filter((c) =>
    conversationDisplayTitle(c).toLocaleLowerCase("uk-UA").includes(normalized),
  );
}
