/** Client-only filter for conversations already returned by the authenticated API. */
export type ConversationSummary = {
  id: string;
  title?: string | null;
  is_group?: boolean;
};

export function filterConversations<T extends ConversationSummary>(
  conversations: T[],
  search: string,
): T[] {
  const normalized = search.trim().toLocaleLowerCase("uk-UA");
  if (!normalized) return conversations;
  return conversations.filter((c) =>
    String(c.title ?? "").toLocaleLowerCase("uk-UA").includes(normalized),
  );
}
