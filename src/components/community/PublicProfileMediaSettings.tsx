import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, ExternalLink, ImagePlus, Images, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import { validateCommunityPhoto } from "./composerPolicy";
import { ProfilePhotoCropDialog } from "./ProfilePhotoCropDialog";
import type { ProfileImageKind } from "./profileMediaCrop";
import "./public-profile-media.css";

type Kind = ProfileImageKind;
type MediaItem = { id: string; bytes: number; createdAt: string };
const labels: Record<Kind, string> = {
  avatar: "Аватар профілю",
  cover: "Обкладинка профілю",
};
const kinds: Kind[] = ["avatar", "cover"];
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);

/** All changes are owner-authorized. Selecting a photo never makes it public by default. */
export function PublicProfileMediaSettings({ publicUrl }: { publicUrl?: string }) {
  const { user, profile, updateProfileData } = useAuth();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [crop, setCrop] = useState<{ kind: Kind; file: File } | null>(null);
  const [picker, setPicker] = useState<Kind | null>(null);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const pickerCloseRef = useRef<HTMLButtonElement>(null);
  const ownerRef = useRef(user?.uid);
  const enabled = profile?.community?.publicProfileEnabled === true;
  ownerRef.current = user?.uid;

  // Never let thumbnails from one signed-in account persist into another.
  useEffect(() => {
    setPicker(null);
    setLibrary([]);
    setNext(null);
    setCrop(null);
  }, [user?.uid]);

  useEffect(() => {
    if (!picker) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    pickerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [picker]);

  const mediaId = (kind: Kind) => {
    const id = profile?.community?.[kind + "MediaId"];
    return validId(id) ? id : null;
  };
  const audience = (kind: Kind): "private" | "public" =>
    profile?.community?.[kind + "Audience"] === "public" ? "public" : "private";
  const ownerUrl = (id: string) => "/api/community/media/" + encodeURIComponent(id);

  async function upload(kind: Kind, file: File): Promise<boolean> {
    const problem = validateCommunityPhoto(file, 0);
    if (problem) { setError(problem); return false; }
    if (busy !== null) return false;
    setBusy(kind); setError(""); setNotice("");
    try {
      const uploaded = await apiJson("/api/community/media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!validId(uploaded.id)) throw new Error("Некоректна відповідь при завантаженні");
      await updateProfileData({
        community: {
          [kind + "MediaId"]: uploaded.id,
          [kind + "Audience"]: "private",
        },
      });
      setNotice(labels[kind] + " встановлено. Фото приватне — щоб показати його в /u/, окремо відкрийте доступ.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити фото");
      return false;
    } finally { setBusy(null); }
  }

  function pickFile(kind: Kind, file: File) {
    const problem = validateCommunityPhoto(file, 0);
    if (problem) { setError(problem); return; }
    if (busy !== null) return;
    setError(""); setNotice(""); setCrop({ kind, file });
  }

  async function loadLibrary(before?: string) {
    if (libraryBusy) return;
    const owner = user?.uid;
    if (!owner) return;
    setLibraryBusy(true); setError("");
    try {
      const data = await apiJson("/api/community/media/library" +
        (before ? "?before=" + encodeURIComponent(before) : ""));
      if (ownerRef.current !== owner) return;
      if (!Array.isArray(data.items)) throw new Error("Не вдалося завантажити ваші фото");
      const items: MediaItem[] = data.items.filter((x: any) =>
        x && validId(x.id) && typeof x.bytes === "number");
      setLibrary(prev => before ? [
        ...prev, ...items.filter(x => !prev.some(y => y.id === x.id)),
      ] : items);
      setNext(validId(data.next) ? data.next : null);
    } catch (e) {
      if (ownerRef.current === owner) {
        setError(e instanceof Error ? e.message : "Галерея тимчасово недоступна");
      }
    } finally {
      if (ownerRef.current === owner) setLibraryBusy(false);
    }
  }

  function openLibrary(kind: Kind) {
    if (busy) return;
    setPicker(kind); setLibrary([]); setNext(null);
    void loadLibrary();
  }

  async function chooseFromLibrary(kind: Kind, id: string) {
    if (busy || !validId(id)) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      // The profile PATCH independently checks ownership in PostgreSQL.
      await updateProfileData({
        community: { [kind + "MediaId"]: id, [kind + "Audience"]: "private" },
      });
      setPicker(null);
      setNotice(labels[kind] + " вибрано з вашої галереї. Фото приватне, доки ви не дозволите публікацію.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося вибрати фото");
    } finally { setBusy(null); }
  }

  async function visibility(kind: Kind, value: "private" | "public") {
    if (busy) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      await updateProfileData({ community: { [kind + "Audience"]: value } });
      setNotice(value === "public"
        ? labels[kind] + " доступний відвідувачам відкритого профілю."
        : labels[kind] + " приховано від гостей.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося змінити доступ");
    } finally { setBusy(null); }
  }

  async function unassign(kind: Kind) {
    if (busy || !window.confirm("Прибрати зображення з оформлення профілю?")) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      await updateProfileData({
        community: { [kind + "MediaId"]: null, [kind + "Audience"]: "private" },
      });
      setNotice(labels[kind] + " прибрано з оформлення. Оригінал залишився у вашій приватній галереї.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося прибрати зображення");
    } finally { setBusy(null); }
  }

  const avatar = mediaId("avatar"), cover = mediaId("cover");
  const avatarLetter = (profile?.displayName || "Т").trim().slice(0, 1).toUpperCase();

  return (
    <section className="community-public-media-settings" aria-label="Аватар та обкладинка публічного профілю">
      <div className="community-public-media-heading">
        <Camera size={20} aria-hidden="true" />
        <div>
          <h3>Оформлення профілю у стилі social</h3>
          <p>Виберіть аватар і банер, налаштуйте кадрування та вирішіть, хто бачить фотографії. JPEG, PNG, WebP до 5 МіБ.</p>
        </div>
      </div>
      <div className="community-public-social-preview" aria-label="Як виглядатиме шапка вашого профілю">
        <div className="community-public-social-cover">
          {cover && <img src={ownerUrl(cover)} alt="Попередній перегляд обкладинки" />}
          <span>h00k / TRADER NETWORK</span>
        </div>
        <div className="community-public-social-identity">
          <div className="community-public-social-avatar">
            {avatar ? <img src={ownerUrl(avatar)} alt="Ваш аватар" /> : avatarLetter}
          </div>
          <div>
            <strong>{profile?.displayName || "Трейдер"}</strong>
            <small>h00k Community · публічний профіль</small>
          </div>
        </div>
        <small className="community-public-social-disclaimer">Це приватний попередній перегляд. Відвідувачі побачать тільки фото, для яких дозволено публічний доступ.</small>
      </div>
      <div className="community-public-media-grid">
        {kinds.map(kind => {
          const id = mediaId(kind);
          const open = audience(kind);
          const processing = busy !== null;
          return <div className="community-public-media-item" key={kind}>
            <h4>{labels[kind]}</h4>
            <div className={"community-public-media-preview community-public-media-" + kind}>
              {id
                ? <img src={ownerUrl(id)} alt={"Попередній перегляд: " + labels[kind]} />
                : <span>{kind === "avatar" ? avatarLetter : "h00k Community"}</span>}
            </div>
            <div className="community-public-media-actions">
              <label className="community-public-media-upload">
                <ImagePlus size={15} aria-hidden="true" /> {processing ? "Обробка…" : "Вибрати файл і кадрувати"}
                <input type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={processing}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) pickFile(kind, file);
                  }} />
              </label>
              <button type="button" className="community-public-media-library-button"
                disabled={processing} onClick={() => openLibrary(kind)}>
                <Images size={15} aria-hidden="true" /> Мої завантажені фото
              </button>
            </div>
            {id && <div className="community-public-media-controls">
              <label>
                Хто бачить зображення
                <select value={open} disabled={processing}
                  onChange={event => void visibility(kind, event.target.value === "public" ? "public" : "private")}>
                  <option value="private">Лише я</option>
                  <option value="public">Усі відвідувачі /u/</option>
                </select>
              </label>
              <button type="button" disabled={processing} onClick={() => void unassign(kind)}>
                <Trash2 size={15} aria-hidden="true" /> Прибрати з профілю
              </button>
            </div>}
            {open === "public" && id && <small className="community-public-media-public">
              <ShieldCheck size={14} aria-hidden="true" /> Зображення опубліковано
            </small>}
          </div>;
        })}
      </div>
      {publicUrl && enabled && <a className="community-public-media-open-profile" href={publicUrl}
        target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} aria-hidden="true" /> Відкрити свою публічну сторінку
      </a>}
      {!enabled && <p className="community-public-media-note">
        Публічний профіль вимкнений — гості не побачать навіть опубліковані зображення.
      </p>}
      {error && <p className="community-public-media-error" role="alert">{error}</p>}
      {notice && <p className="community-public-media-note" role="status">{notice}</p>}

      {crop && <ProfilePhotoCropDialog key={crop.kind + crop.file.name}
        kind={crop.kind} file={crop.file} onClose={() => setCrop(null)}
        onSave={file => upload(crop.kind, file)} />}

      {picker && <div className="community-public-media-picker-backdrop">
        <section className="community-public-media-picker" role="dialog" aria-modal="true"
          aria-label={"Виберіть " + labels[picker].toLowerCase()}
          onKeyDown={event => {
            if (event.key === "Escape" && !busy) { event.stopPropagation(); setPicker(null); }
          }}>
          <header><h3>Мої фотографії · {labels[picker]}</h3>
            <button ref={pickerCloseRef} type="button" disabled={!!busy} onClick={() => setPicker(null)}
              aria-label="Закрити галерею">Закрити</button>
          </header>
          <p>Тільки ваші завантажені фото. Після вибору доступ автоматично стане приватним.</p>
          {library.length ? <div className="community-public-media-library-grid">
            {library.map(item => <button key={item.id} type="button"
              disabled={!!busy} onClick={() => void chooseFromLibrary(picker, item.id)}
              title="Вибрати це фото">
              <img loading="lazy" src={ownerUrl(item.id)} alt="Ваше зображення з галереї" />
              {mediaId(picker) === item.id && <span><Check size={15} /> Обрано</span>}
            </button>)}
          </div> : !libraryBusy && <p className="community-public-media-note">
            Галерея порожня. Завантажте перше фото з пристрою.
          </p>}
          {libraryBusy && <p role="status">Завантажуємо ваші фото…</p>}
          {error && <p role="alert" className="community-public-media-error">{error}</p>}
          {next && <button type="button" className="community-public-media-load-more"
            disabled={libraryBusy || !!busy} onClick={() => void loadLibrary(next)}>
            Показати ще
          </button>}
        </section>
      </div>}
    </section>
  );
}
