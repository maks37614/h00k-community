import React, { useEffect, useRef, useState } from "react";
import { Check, Crop, X } from "lucide-react";
import { validateCommunityPhoto } from "./composerPolicy";
import {
  drawProfileCrop, PROFILE_CROP_SIZE,
  type ProfileCrop, type ProfileImageKind,
} from "./profileMediaCrop";

const labels = { avatar: "аватара", cover: "обкладинки" } as const;

export function ProfilePhotoCropDialog({
  kind, file, onSave, onClose,
}: {
  kind: ProfileImageKind;
  file: File;
  onSave: (file: File) => Promise<boolean>;
  onClose: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<ProfileCrop>({ zoom: 1, x: 50, y: 50 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dimensions = PROFILE_CROP_SIZE[kind];

  useEffect(() => {
    closeRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const url = URL.createObjectURL(file);
    const photo = new Image();
    let active = true;
    photo.onload = () => {
      if (active) {
        if (!photo.naturalWidth || !photo.naturalHeight) setError("Не вдалося прочитати розмір фото.");
        else if (photo.naturalWidth * photo.naturalHeight > 16_000_000)
          setError("Зображення завелике за роздільністю. Оберіть фото до 16 мегапікселів.");
        else setImage(photo);
      }
    };
    photo.onerror = () => { if (active) setError("Не вдалося відкрити фото. Виберіть інший файл."); };
    photo.src = url;
    return () => {
      active = false;
      photo.onload = null;
      photo.onerror = null;
      URL.revokeObjectURL(url);
      document.body.style.overflow = oldOverflow;
    };
  }, [file]);

  useEffect(() => {
    if (!image || !previewRef.current) return;
    try { drawProfileCrop(previewRef.current, image, crop); }
    catch (e) { setError(e instanceof Error ? e.message : "Не вдалося показати фото"); }
  }, [image, crop]);

  const change = (key: keyof ProfileCrop, value: number) => {
    setCrop(prev => ({ ...prev, [key]: value }));
  };

  async function save() {
    if (!image || saving) return;
    setSaving(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      drawProfileCrop(canvas, image, crop);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          result => result ? resolve(result) : reject(new Error("Браузер не зміг підготувати фото")),
          "image/webp", 0.84,
        );
      });
      const mime = ["image/webp", "image/png", "image/jpeg"].includes(blob.type)
        ? blob.type : "image/png";
      const ext = mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : "png";
      const output = new File([blob], kind + "." + ext, { type: mime });
      const problem = validateCommunityPhoto(output, 0);
      if (problem) throw new Error(problem);
      if (await onSave(output)) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося обробити фото");
    } finally {
      setSaving(false);
    }
  }

  return <div className="community-photo-crop-backdrop">
    <section className="community-photo-crop-dialog" role="dialog" aria-modal="true"
      aria-label={"Налаштування " + labels[kind]}
      onKeyDown={event => { if (event.key === "Escape" && !saving) { event.stopPropagation(); onClose(); } }}>
      <header>
        <h3><Crop size={18} aria-hidden="true" /> Налаштування {labels[kind]}</h3>
        <button ref={closeRef} type="button" onClick={onClose} disabled={saving} aria-label="Закрити редактор фото">
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <p className="community-photo-crop-hint">
        {kind === "avatar"
          ? "Аватар відображатиметься квадратом із заокругленими кутами, як у профілі social."
          : "Обкладинка відображатиметься широким банером із аватаром поверх неї."}
        {" "}Виберіть масштаб і положення, потім збережіть.
      </p>
      <div className={"community-photo-crop-stage community-photo-crop-stage-" + kind}>
        <canvas ref={previewRef} width={kind === "avatar" ? 360 : 720}
          height={kind === "avatar" ? 360 : 270}
          role="img" aria-label={"Попередній перегляд " + labels[kind]} />
        {!image && !error && <p role="status">Відкриваємо фото…</p>}
      </div>
      <div className="community-photo-crop-sliders">
        <label>Масштаб: {Math.round(crop.zoom * 100)}%
          <input type="range" min="1" max="3" step=".05" value={crop.zoom}
            disabled={saving} onChange={e => change("zoom", Number(e.target.value))} />
        </label>
        <label>Положення по горизонталі
          <input type="range" min="0" max="100" step="1" value={crop.x}
            disabled={saving} onChange={e => change("x", Number(e.target.value))} />
        </label>
        <label>Положення по вертикалі
          <input type="range" min="0" max="100" step="1" value={crop.y}
            disabled={saving} onChange={e => change("y", Number(e.target.value))} />
        </label>
      </div>
      {error && <p className="community-public-media-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="community-photo-crop-cancel"
          disabled={saving} onClick={onClose}>Скасувати</button>
        <button type="button" className="community-photo-crop-save"
          disabled={!image || !!error || saving} onClick={() => void save()}>
          <Check size={16} aria-hidden="true" /> {saving ? "Зберігаємо…" : "Зберегти фото"}
        </button>
      </footer>
      <small>Після завантаження фото залишиться приватним, доки ви не дозволите публічний показ.</small>
    </section>
  </div>;
}
