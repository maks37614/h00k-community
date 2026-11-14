/**
 * Deterministic in-browser crop matching the avatar and wide cover layout
 * of the social TraderProfileView. Only the cropped raster is uploaded.
 */
export type ProfileImageKind = "avatar" | "cover";
export type ProfileCrop = { zoom: number; x: number; y: number };
export const PROFILE_CROP_SIZE: Record<ProfileImageKind, { width: number; height: number }> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1440, height: 540 },
};

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

export function profileCropGeometry(
  imageWidth: number,
  imageHeight: number,
  outputWidth: number,
  outputHeight: number,
  crop: ProfileCrop,
) {
  if (![imageWidth,imageHeight,outputWidth,outputHeight].every(n=>Number.isFinite(n)&&n>0))
    throw new Error("Некоректні розміри зображення");
  const zoom = clamp(crop.zoom, 1, 3);
  const scale = Math.max(outputWidth / imageWidth, outputHeight / imageHeight) * zoom;
  const width = Math.min(imageWidth, outputWidth / scale);
  const height = Math.min(imageHeight, outputHeight / scale);
  const x = (imageWidth - width) * clamp(crop.x, 0, 100) / 100;
  const y = (imageHeight - height) * clamp(crop.y, 0, 100) / 100;
  return { x, y, width, height };
}

export function drawProfileCrop(
  canvas: HTMLCanvasElement,
  image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight"> & CanvasImageSource,
  crop: ProfileCrop,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Редактор фото недоступний у цьому браузері");
  const bounds = profileCropGeometry(
    image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, crop,
  );
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image, bounds.x, bounds.y, bounds.width, bounds.height,
    0, 0, canvas.width, canvas.height,
  );
}
