/** Canonical profile handles can be mentioned in group messages with @username.
 * Reject prefix matches such as @anna inside @anna-lee or email addresses.
 * Server resolves recipients against reserved handles and current membership.
 */
export function extractMentionHandles(input: unknown, limit = 30): string[] {
  if (typeof input !== "string" || !input.includes("@")) return [];
  const found = new Set<string>();
  const pattern = /(^|[^a-z0-9-])@([a-z][a-z0-9-]{1,28}[a-z0-9])(?=$|[^a-z0-9-])/gi;
  for (const match of input.matchAll(pattern)) {
    found.add(match[2].toLowerCase());
    if (found.size >= limit) break;
  }
  return [...found];
}
