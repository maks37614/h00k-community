/** Client-side guidance only. The Community API always enforces its own limits. */
export const MAX_COMMUNITY_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_COMMUNITY_PHOTOS = 4;

const supportedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateCommunityPhoto(
  file: Pick<File, "type" | "size">,
  attachedCount: number,
): string | null {
  if (attachedCount >= MAX_COMMUNITY_PHOTOS) {
    return "До одного повідомлення можна додати не більше 4 фото.";
  }
  if (!supportedPhotoTypes.has(file.type)) {
    return "Підтримуються фото JPEG, PNG або WebP.";
  }
  if (file.size <= 0 || file.size > MAX_COMMUNITY_PHOTO_BYTES) {
    return "Розмір одного фото має бути не більше 5 МіБ.";
  }
  return null;
}

export function canSendCommunityContent(text: string, photoCount: number, busy: boolean): boolean {
  return !busy && (text.trim().length > 0 || photoCount > 0);
}

export function communityAudienceHint(kind: "post" | "comment" | "message", audience: string): string {
  if (kind === "message") return "Повідомлення доступне лише учасникам розмови.";
  if (kind === "comment") return "Коментар видимий за правилами доступу до публікації.";
  switch (audience) {
    case "public":
      return "Публічний допис можуть побачити інші учасники спільноти.";
    case "friends":
      return "Допис для підтверджених друзів.";
    default:
      return "Приватний допис — лише для вас. Відкрийте доступ, якщо хочете поділитися ним.";
  }
}
