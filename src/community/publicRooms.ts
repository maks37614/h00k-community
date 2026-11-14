/**
 * Public rooms belong to all signed-in Community users. They are NOT private
 * group chats, verified trade signals, or live exchange streaming channels.
 */
export const COMMUNITY_PUBLIC_ROOMS = [
  {
    slug: "general",
    title: "Загальний чат трейдерів",
    handle: "#загальний-скальпер-чат",
    description: "Обговорення ринку, запитання та досвід трейдерів",
  },
  {
    slug: "setups",
    title: "Ситуації та сетапи",
    handle: "#ситуації-та-сетапи",
    description: "Публічне обговорення торгових ідей без гарантій результату",
  },
] as const;

export type CommunityPublicRoomSlug = typeof COMMUNITY_PUBLIC_ROOMS[number]["slug"];
export function getCommunityPublicRoom(slug: unknown) {
  if (typeof slug !== "string") return null;
  return COMMUNITY_PUBLIC_ROOMS.find(room => room.slug === slug) ?? null;
}
