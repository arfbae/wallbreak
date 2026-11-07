export const WALKTHROUGH_SECONDS = 8;

export function panFrame(width: number, height: number, progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  const eased = p * p * (3 - 2 * p);
  const scale = 1.08;
  return { width: width * scale, height: height * scale, x: -width * .08 * eased, y: -height * .04 };
}

/** Record the actual mockup, never redraw it through an AI model. Browser only. */
export async function recordWalkthrough(imageUrl: string, onProgress: (n: number) => void, signal: AbortSignal): Promise<Blob> {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) throw new Error("Video export is unavailable in this browser. Try Chrome or Edge.");
  const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser cannot record video. Try Chrome or Edge.");
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageUrl;
  await image.decode();
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = Math.max(2, Math.round((1280 * image.naturalHeight / image.naturalWidth) / 2) * 2);
  if (canvas.height > 1920) { canvas.width = Math.round(1920 * image.naturalWidth / image.naturalHeight / 2) * 2; canvas.height = 1920; }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the video.");
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  return new Promise((resolve, reject) => {
    let frame = 0;
    let started: number | null = null;
    let settled = false;
    const cleanup = () => { cancelAnimationFrame(frame); stream.getTracks().forEach(t => t.stop()); signal.removeEventListener("abort", cancel); };
    const fail = (err: Error) => { if (settled) return; settled = true; if (recorder.state !== "inactive") recorder.stop(); cleanup(); reject(err); };
    const cancel = () => fail(new DOMException("Cancelled", "AbortError"));
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => fail(new Error("Video recording failed. Your mockup is unchanged."));
    recorder.onstop = () => { if (settled) return; settled = true; cleanup(); const blob = new Blob(chunks, { type: mime }); blob.size ? resolve(blob) : reject(new Error("The video was empty. Please try again.")); };
    signal.addEventListener("abort", cancel, { once: true });
    const draw = (time: number) => {
      if (settled) return;
      started ??= time;
      const p = Math.min(1, (time - started) / (WALKTHROUGH_SECONDS * 1000));
      const f = panFrame(canvas.width, canvas.height, p);
      ctx.drawImage(image, f.x, f.y, f.width, f.height);
      onProgress(p);
      if (p < 1) frame = requestAnimationFrame(draw); else recorder.stop();
    };
    try { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); recorder.start(250); frame = requestAnimationFrame(draw); }
    catch { fail(new Error("Could not record this image. Download the mockup and upload it again.")); }
  });
}