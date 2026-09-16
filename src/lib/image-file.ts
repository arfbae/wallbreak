/**
 * Client-side image intake: validation, downscaling and compression.
 *
 * Raw camera uploads are routinely 10-25 MB, which makes the server function
 * payload huge and the AI gateway call slow or rejected. Everything that enters
 * the studio is normalised here first.
 */

export const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // hard reject above this
export const MAX_EDGE_PX = 2048; // longest edge after downscale
export const MAX_ENCODED_BYTES = 6 * 1024 * 1024; // data URL budget per image

export class ImageIntakeError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageIntakeError("That file could not be read."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new ImageIntakeError("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageIntakeError("That image appears to be corrupted."));
    img.src = src;
  });
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  resized: boolean;
}

/**
 * Validates a dropped/selected file and returns a normalised data URL.
 * Throws {@link ImageIntakeError} with a message safe to show to the user.
 */
export async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImageIntakeError("Only image files are supported (PNG, JPG, WEBP).");
  }
  if (file.type === "image/svg+xml") {
    throw new ImageIntakeError("SVG files aren't supported — export a PNG or JPG first.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageIntakeError(
      `That image is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please use one under 30 MB.`,
    );
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) throw new ImageIntakeError("That image appears to be empty.");

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
  const needsResize = scale < 1;
  const needsCompress = estimateBytes(original) > MAX_ENCODED_BYTES;

  if (!needsResize && !needsCompress) {
    return { dataUrl: original, width: w, height: h, bytes: estimateBytes(original), resized: false };
  }

  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageIntakeError("Your browser couldn't process that image.");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Preserve alpha for PNGs (cut-out artwork), otherwise compress to JPEG.
  const keepAlpha = file.type === "image/png";
  let out = keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);

  for (const quality of [0.85, 0.75, 0.65]) {
    if (estimateBytes(out) <= MAX_ENCODED_BYTES) break;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  if (estimateBytes(out) > MAX_ENCODED_BYTES) {
    throw new ImageIntakeError("That image is too large to process. Try a smaller export.");
  }

  return {
    dataUrl: out,
    width: targetW,
    height: targetH,
    bytes: estimateBytes(out),
    resized: needsResize,
  };
}
