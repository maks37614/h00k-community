/** Server remains authoritative: this only presents safe edit choices in the UI. */
export type CommunityItemAudience = "private" | "friends" | "public";

const audienceLevels: CommunityItemAudience[] = ["private", "friends", "public"];

export function allowedEditAudiences(current: CommunityItemAudience): CommunityItemAudience[] {
  const index = audienceLevels.indexOf(current);
  return index === -1 ? [] : audienceLevels.slice(0, index + 1);
}

export function audienceLabel(value: CommunityItemAudience): string {
  switch (value) {
    case "public": return "Публічно";
    case "friends": return "Лише друзям";
    default: return "Лише мені";
  }
}

export function canSaveEditedContent(
  newText: string,
  originalBody: { title?: unknown; photos?: unknown },
  saving: boolean,
): boolean {
  if (saving || newText.length > 20_000) return false;
  // Server accepts a title or a photo-only post, too.
  const title = typeof originalBody.title === "string" ? originalBody.title.trim() : "";
  const photos = Array.isArray(originalBody.photos) ? originalBody.photos : [];
  return !!newText.trim() || !!title || photos.length > 0;
}

export function buildEditedItemPayload(
  item: {
    revision: number;
    audience: CommunityItemAudience;
    body: Record<string, unknown>;
  },
  text: string,
  audience: CommunityItemAudience,
): {
  revision: number;
  audience: CommunityItemAudience;
  body: Record<string, unknown>;
} {
  if (!Number.isSafeInteger(item.revision) || item.revision < 1)
    throw new Error("Не вдалося визначити версію матеріалу. Оновіть стрічку.");
  if (!allowedEditAudiences(item.audience).includes(audience))
    throw new Error("Розширення аудиторії під час редагування заборонено.");
  if (!canSaveEditedContent(text, item.body, false))
    throw new Error("Додайте текст або залиште назву чи фото.");
  return {
    revision: item.revision,
    audience,
    // Keep attachments, origin/strategy references and title immutable.
    body: { ...item.body, text: text.trim() },
  };
}
