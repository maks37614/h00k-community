/** View-only normalization for Community friendships. The server remains authoritative. */
export type FriendFilter = "all" | "friends" | "requests";

export type CommunityFriend = {
  id: string;
  displayName?: string;
  accepted?: boolean;
  incoming?: boolean;
  friend?: boolean;
};

export type CommunityFriendRow = CommunityFriend & {
  isAccepted: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  statusText: string;
};

export function buildFriendDirectory(
  relationships: CommunityFriend[],
  searchResults: CommunityFriend[],
  filter: FriendFilter = "all",
): { rows: CommunityFriendRow[]; friendsCount: number; requestsCount: number } {
  const relations = new Map<string, CommunityFriend>();
  const people = new Map<string, CommunityFriend>();

  for (const person of relationships) {
    if (!person?.id) continue;
    relations.set(person.id, person);
    people.set(person.id, person);
  }
  for (const candidate of searchResults) {
    if (!candidate?.id) continue;
    const existing = relations.get(candidate.id);
    people.set(candidate.id, existing ? { ...candidate, ...existing } : candidate);
  }

  const rows = [...people.values()].map((person): CommunityFriendRow => {
    const relation = relations.get(person.id);
    const isAccepted = relation
      ? relation.accepted === true
      : person.friend === true;
    const isIncoming = !!relation && !isAccepted && relation.incoming === true;
    const isOutgoing = !!relation && !isAccepted && !isIncoming;
    return {
      ...person,
      isAccepted,
      isIncoming,
      isOutgoing,
      statusText: isAccepted
        ? "Друзі"
        : isIncoming
          ? "Вхідний запит"
          : isOutgoing
            ? "Запит надіслано"
            : "Трейдер",
    };
  });

  const filtered = rows.filter((person) => {
    if (filter === "friends") return person.isAccepted;
    if (filter === "requests") return person.isIncoming || person.isOutgoing;
    return true;
  });

  return {
    rows: filtered,
    friendsCount: [...relations.values()].filter((p) => p.accepted === true).length,
    requestsCount: [...relations.values()].filter((p) => p.accepted !== true).length,
  };
}
