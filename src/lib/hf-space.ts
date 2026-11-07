// Allowlisted official Space only. No arbitrary URLs or community credential sharing.
export const HF_SPACE_ORIGIN = "https://qwen-qwen-image-edit-2509.hf.space";
export const HF_SPACE_MAX_IMAGES = 3;

export function spaceSupportsRequest(artworks: string[], wall: string | null) {
  return artworks.length > 0 && artworks.length + (wall ? 1 : 0) <= HF_SPACE_MAX_IMAGES;
}

export function spaceInputs(images: { path: string; mime: string }[], prompt: string) {
  if (images.length < 1 || images.length > HF_SPACE_MAX_IMAGES) throw new Error("This Space supports up to three reference images; none may be dropped.");
  return [images.map(i => ({ image: { path: i.path, mime_type: i.mime, meta: { _type: "gradio.FileData" } }, caption: null })), prompt, 0, true, 4, 40, 256, 256, false];
}

/** Gradio upload + queued /infer, preserving prompt verbatim and disabling prompt rewriting. */
export async function callHfSpace(images: string[], prompt: string, token: string, fetchImpl: typeof fetch): Promise<Response> {
  const signal = AbortSignal.timeout(360_000);
  const headers = { Authorization: `Bearer ${token}` };
  const form = new FormData();
  const files: { mime: string }[] = [];
  for (let i = 0; i < images.length; i++) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(images[i]);
    if (!match) return new Response("Unsupported reference image", { status: 400 });
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    form.append("files", new Blob([bytes], { type: match[1] }), `reference-${i}.${match[1].split("/")[1]}`);
    files.push({ mime: match[1] });
  }
  const upload = await fetchImpl(`${HF_SPACE_ORIGIN}/gradio_api/upload`, { method: "POST", headers, body: form, signal });
  if (!upload.ok) return upload;
  const paths: unknown = await upload.json();
  if (!Array.isArray(paths) || paths.length !== images.length || paths.some(p => typeof p !== "string")) return new Response("Reference upload incomplete", { status: 400 });
  const call = await fetchImpl(`${HF_SPACE_ORIGIN}/gradio_api/call/infer`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ data: spaceInputs(paths.map((path, i) => ({ path, mime: files[i].mime })), prompt) }),
  });
  if (!call.ok) return call;
  const job = await call.json() as { event_id?: string };
  if (!job.event_id || !/^[\w-]+$/.test(job.event_id)) return new Response("Invalid Space job", { status: 502 });
  const events = await fetchImpl(`${HF_SPACE_ORIGIN}/gradio_api/call/infer/${job.event_id}`, { headers, signal });
  if (!events.ok || !events.body) return events;
  const reader = events.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r/g, "");
      let index: number;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const text = block.split("\n").filter(l => l.startsWith("data: ")).map(l => l.slice(6)).join("\n");
        if (event === "error") {
          const status = /quota|daily|zerogpu|gpu.*duration|limit/i.test(text) ? 429 : 400;
          return new Response(status === 429 ? "Free Space allowance or capacity unavailable" : "Space declined the request", { status });
        }
        if (event === "complete") {
          const result = JSON.parse(text);
          const image = result?.[0]?.[0]?.image;
          const url = image?.url ?? (image?.path ? `${HF_SPACE_ORIGIN}/gradio_api/file=${encodeURIComponent(image.path)}` : null);
          if (typeof url !== "string" || new URL(url).origin !== HF_SPACE_ORIGIN) return new Response("Space returned no valid image", { status: 400 });
          return Response.json({ images: [{ url }] });
        }
      }
      if (done) break;
    }
    return new Response("Space did not finish the image", { status: 502 });
  } finally { await reader.cancel().catch(() => {}); }
}