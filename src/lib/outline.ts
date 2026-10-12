import jsfeat from "jsfeat";

/** Canny contours preserve source coordinates; no generative redraw or scene cropping. */
export function outlinePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  detail = 65,
  lineWidth = 1,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    rgba.length !== width * height * 4
  ) {
    throw new Error("The image could not be read.");
  }
  const gray = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
  const edges = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
  jsfeat.imgproc.grayscale(rgba, width, height, gray);
  jsfeat.imgproc.gaussian_blur(gray, gray, 5, 1);
  const high = 100 - Math.min(100, Math.max(0, detail)) * 0.8;
  jsfeat.imgproc.canny(gray, edges, high * 0.4, high);
  const output = new Uint8ClampedArray(width * height * 4).fill(255);
  const radius = Math.min(2, Math.max(0, Math.round(lineWidth) - 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!edges.data[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const offset = (py * width + px) * 4;
          output[offset] = output[offset + 1] = output[offset + 2] = 0;
        }
      }
    }
  }
  return output;
}

export async function loadOutlineSource(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error("This mockup could not be opened. Please try again.");
  }
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("This mockup has no readable image.");
  return image;
}

export function createOutline(image: HTMLImageElement, detail: number, lineWidth: number) {
  const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Your browser could not prepare the outline.");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    pixels.data.set(outlinePixels(pixels.data, canvas.width, canvas.height, detail, lineWidth));
    context.putImageData(pixels, 0, 0);
    return { url: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } catch {
    throw new Error("This image could not be converted. Try a mockup saved in your library.");
  }
}
