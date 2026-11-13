import React, { useState } from "react";
import { ImagePlus, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import { validateCommunityPhoto } from "./composerPolicy";
import "./public-profile-media.css";

type Kind = "avatar" | "cover";
const labels: Record<Kind, string> = {
  avatar: "Аватар профілю",
  cover: "Обкладинка профілю",
};
const kinds: Kind[] = ["avatar", "cover"];

/** Explicit opt-in for every image; upload never automatically makes it public. */
export function PublicProfileMediaSettings() {
  const { profile, updateProfileData } = useAuth();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const enabled = profile?.community?.publicProfileEnabled === true;

  async function upload(kind: Kind, file: File) {
    const problem = validateCommunityPhoto(file, 0);
    if (problem) { setError(problem); return; }
    if (busy) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      const uploaded = await apiJson("/api/community/media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (typeof uploaded.id !== "string" || !/^[a-f0-9-]{36}$/i.test(uploaded.id))
        throw new Error("Некоректна відповідь при завантаженні");
      await updateProfileData({
        community: {
          [kind + "MediaId"]: uploaded.id,
          [kind + "Audience"]: "private",
        },
      });
      setNotice(labels[kind] + " завантажено. Зображення приватне, доки ви його не опублікуєте.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити фото");
    } finally { setBusy(null); }
  }

  async function visibility(kind: Kind, audience: "private" | "public") {
    if (busy) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      await updateProfileData({ community: { [kind + "Audience"]: audience } });
      setNotice(audience === "public"
        ? labels[kind] + " доступний усім відвідувачам відкритого профілю."
        : labels[kind] + " приховано від гостей.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося змінити доступ");
    } finally { setBusy(null); }
  }

  async function unassign(kind: Kind) {
    if (busy || !window.confirm("Прибрати зображення з оформлення профілю?")) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      await updateProfileData({ community: { [kind + "MediaId"]: null, [kind + "Audience"]: "private" } });
      setNotice(labels[kind] + " прибрано з оформлення профілю.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося прибрати зображення");
    } finally { setBusy(null); }
  }

  return (
    <section className="community-public-media-settings" aria-label="Аватар та обкладинка публічного профілю">
      <div className="community-public-media-heading">
        <ImagePlus size={20} aria-hidden="true" />
        <div>
          <h3>Фото та обкладинка сторінки /u/</h3>
          <p>JPEG, PNG або WebP до 5 МБ. Сервер обробляє та зберігає файли у власному медіасховищі.</p>
        </div>
      </div>
      <div className="community-public-media-grid">
        {kinds.map(kind => {
          const mediaId = profile?.community?.[kind + "MediaId"] as string | undefined | null;
          const audience = profile?.community?.[kind + "Audience"] === "public" ? "public" : "private";
          const processing = busy !== null;
          return <div className="community-public-media-item" key={kind}>
            <h4>{labels[kind]}</h4>
            <div className={"community-public-media-preview community-public-media-" + kind}>
              {mediaId
                ? <img src={"/api/community/media/" + encodeURIComponent(mediaId)} alt={"Попередній перегляд: " + labels[kind]} />
                : <span>{kind === "avatar" ? (profile?.displayName || "Т").slice(0, 1).toUpperCase() : "h00k Community"}</span>}
            </div>
            <label className="community-public-media-upload">
              <ImagePlus size={15} aria-hidden="true" /> {processing ? "Обробка…" : "Завантажити фото"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={processing}
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(kind, file);
                }}
              />
            </label>
            {mediaId && <div className="community-public-media-controls">
              <label>
                Хто бачить зображення
                <select
                  value={audience}
                  disabled={processing}
                  onChange={event => void visibility(kind, event.target.value === "public" ? "public" : "private")}
                >
                  <option value="private">Лише я</option>
                  <option value="public">Усі відвідувачі /u/</option>
                </select>
              </label>
              <button type="button" disabled={processing} onClick={() => void unassign(kind)}>
                <Trash2 size={15} aria-hidden="true" /> Прибрати з профілю
              </button>
            </div>}
            {audience === "public" && mediaId && <small className="community-public-media-public"><ShieldCheck size={14} aria-hidden="true" /> Зображення опубліковано</small>}
          </div>;
        })}
      </div>
      {!enabled && <p className="community-public-media-note">Публічний профіль зараз вимкнений — гості не побачать навіть опубліковані зображення.</p>}
      {error && <p className="community-public-media-error" role="alert">{error}</p>}
      {notice && <p className="community-public-media-note" role="status">{notice}</p>}
    </section>
  );
}
