import React, { useEffect, useRef, useState } from "react";
import { BookOpenText, ChevronLeft, ChevronRight, Clock3, ExternalLink, X } from "lucide-react";
import "./publicProfilePhotos.css";

/** The public API independently authorizes each requested media file. */
export function publicPhotoIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string =>
    typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id),
  ).slice(0, 4);
}

export function publicPhotoUrl(base: string, postId: string, mediaId: string): string {
  const id = publicPhotoIds([mediaId])[0];
  if (!id || !publicPhotoIds([postId]).length) throw new Error("Некоректне фото публікації");
  return base + "/posts/" + encodeURIComponent(postId) + "/media/" + encodeURIComponent(id);
}

type Props = {
  ids: string[];
  base: string;
  postId: string;
  label: string;
  variant?: "post" | "article";
  readMinutes?: number;
};

/** Compact thumbnails with a native modal viewer, keyboard navigation and no background downloads. */
export function PublicProfilePhotoGallery({
  ids, base, postId, label, variant = "post", readMinutes,
}: Props) {
  const photos = publicPhotoIds(ids);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openedByRef = useRef<HTMLButtonElement | null>(null);
  const active = activeIndex !== null ? photos[activeIndex] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active === null || active === undefined) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
  }, [active]);

  useEffect(() => {
    if (activeIndex === null || photos.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex(index => index === null ? null :
          (index + (event.key === "ArrowRight" ? 1 : -1) + photos.length) % photos.length);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, photos.length]);

  const open = (index: number, element: HTMLButtonElement) => {
    openedByRef.current = element;
    setActiveIndex(index);
  };
  const close = () => setActiveIndex(null);
  const onClosed = () => {
    setActiveIndex(null);
    openedByRef.current?.focus({ preventScroll: true });
    openedByRef.current = null;
  };
  const media = (id: string) => publicPhotoUrl(base, postId, id);
  const imageButton = (id: string, index: number, cover = false) =>
    <button key={id} type="button"
      className={"public-photo-thumb" + (cover ? " public-photo-thumb-cover" : "")}
      aria-label={`Переглянути фото ${index + 1} із ${photos.length}: ${label}`}
      onClick={event => open(index, event.currentTarget)}>
      <img loading={cover ? "eager" : "lazy"} alt={`${label}: фото ${index + 1}`} src={media(id)} />
    </button>;

  return <>
    {variant === "article" ? <>
      <div className="public-article-reader-cover public-photo-article-cover">
        {photos[0] ? imageButton(photos[0], 0, true) : <BookOpenText size={62} aria-hidden="true" />}
        {typeof readMinutes === "number" && Number.isFinite(readMinutes) && <span className="public-article-readtime">
          <Clock3 size={14} aria-hidden="true" /> ≈ {Math.max(1, Math.round(readMinutes))} хв читання
        </span>}
      </div>
      {photos.length > 1 && <div className="public-article-reader-gallery public-photo-article-extras" aria-label={label}>
        {photos.slice(1).map((id, index) => imageButton(id, index + 1))}
      </div>}
    </> : photos.length > 0 && <div className="public-profile-photos public-photo-gallery-post" aria-label={label}>
      {photos.map((id, index) => imageButton(id, index))}
    </div>}

    {photos.length > 0 && <dialog ref={dialogRef} className="public-photo-dialog"
      aria-label={`Перегляд фотографій: ${label}`}
      onClose={onClosed}
      onClick={event => { if (event.target === dialogRef.current) close(); }}>
      {active && <div className="public-photo-dialog-inner">
        <header className="public-photo-dialog-header">
          <span>{label} · {activeIndex! + 1} / {photos.length}</span>
          <button type="button" onClick={close} aria-label="Закрити фотографію">
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <div className="public-photo-dialog-image"><img src={media(active)} alt={`${label}: фото ${activeIndex! + 1}`} /></div>
        <footer className="public-photo-dialog-footer">
          <div className="public-photo-dialog-controls">
            {photos.length > 1 && <>
              <button type="button" aria-label="Попереднє фото" onClick={() => setActiveIndex(index => index === null ? null : (index - 1 + photos.length) % photos.length)}>
                <ChevronLeft size={21} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Наступне фото" onClick={() => setActiveIndex(index => index === null ? null : (index + 1) % photos.length)}>
                <ChevronRight size={21} aria-hidden="true" />
              </button>
            </>}
          </div>
          <a href={media(active)} target="_blank" rel="noopener noreferrer">
            Оригінал <ExternalLink size={15} aria-hidden="true" />
          </a>
        </footer>
      </div>}
    </dialog>}
  </>;
}
