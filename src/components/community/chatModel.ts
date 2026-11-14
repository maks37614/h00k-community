/** Client-only filter for conversations already returned by the authenticated API. */
export type ConversationSummary = {
  id: string;
  title?: string | null;
  is_group?: boolean;
  peer_name?: string | null;
  peer_id?: string | null;
  last_message_text?: string | null;
  last_message_created_at?: string | null;
  last_message_mine?: boolean | null;
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

/** Only previews from the membership-scoped conversation API; no guessed activity data. */
export function conversationPreview(conversation: ConversationSummary): string {
  if (!conversation.last_message_created_at)
    return conversation.is_group ? "Групова розмова" : "Особистий діалог";
  const text = conversation.last_message_text?.trim() || "Вкладення";
  return (conversation.last_message_mine ? "Ви: " : "") + text;
}

export function conversationPreviewTime(conversation: ConversationSummary, now = new Date()): string {
  if (!conversation.last_message_created_at) return "";
  const date = new Date(conversation.last_message_created_at);
  if (!Number.isFinite(date.getTime())) return "";
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
}
