/** Validate media identifiers before requesting server-authorized public photos. */
export function publicPhotoIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string =>
    typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id),
  ).slice(0, 4);
}

/** Always fetch through the current profile's post-scoped, privacy-gated API. */
export function publicPhotoUrl(base: string, postId: string, mediaId: string): string {
  const id = publicPhotoIds([mediaId])[0];
  if (!id || !publicPhotoIds([postId]).length || !/^\/api\/public\/profiles\/[a-z0-9-]+$/i.test(base))
    throw new Error("Некоректне фото публікації");
  return base + "/posts/" + encodeURIComponent(postId) + "/media/" + encodeURIComponent(id);
}
