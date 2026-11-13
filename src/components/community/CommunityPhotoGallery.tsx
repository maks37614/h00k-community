import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

/** Uses only existing authenticated media URLs. The server enforces visibility. */
export function CommunityPhotoGallery({
  ids,
  label,
}: {
  ids: string[];
  label: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photos = ids.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id));
  const length = photos.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeIndex === null || activeIndex >= length) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
  }, [activeIndex, length]);

  if (length === 0) return null;
  const media = (id: string) => "/api/community/media/" + encodeURIComponent(id);
  const activeId = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <div className="community-photo-gallery" aria-label={label}>
      <div className="community-photo-strip">
        {photos.map((id, index) => (
          <button
            type="button"
            className="community-photo-gallery-thumb"
            key={id + ":" + index}
            aria-label={`Переглянути фото ${index + 1} із ${length}`}
            onClick={() => setActiveIndex(index)}
          >
            <img loading="lazy" alt={`${label}: фото ${index + 1}`} src={media(id)} />
          </button>
        ))}
      </div>
      <dialog
        ref={dialogRef}
        className="community-photo-dialog"
        aria-label={`Перегляд фото: ${label}`}
        onClose={() => setActiveIndex(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setActiveIndex(null);
        }}
      >
        {activeId && (
          <div className="community-photo-dialog-content">
            <div className="community-photo-dialog-header">
              <span>{label} · {activeIndex! + 1} / {length}</span>
              <button type="button" onClick={() => setActiveIndex(null)} aria-label="Закрити перегляд">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="community-photo-dialog-image">
              <img src={media(activeId)} alt={`${label}: фото ${activeIndex! + 1}`} />
            </div>
            <div className="community-photo-dialog-footer">
              {length > 1 && (
                <div className="community-photo-dialog-navigation">
                  <button
                    type="button"
                    aria-label="Попереднє фото"
                    onClick={() => setActiveIndex((i) => i === null ? 0 : (i - 1 + length) % length)}
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Наступне фото"
                    onClick={() => setActiveIndex((i) => i === null ? 0 : (i + 1) % length)}
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
              <a href={media(activeId)} target="_blank" rel="noopener noreferrer">
                Відкрити оригінал <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
