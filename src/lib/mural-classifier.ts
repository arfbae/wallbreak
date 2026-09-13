/**
 * Post-render medium classifier.
 *
 * After the renderer returns an image we send that image BACK to a vision
 * model and ask it to classify the medium/style actually visible. This catches
 * the failure the text channel misses: a pasted print / ghosted overlay that
 * the renderer never described in words.
 */

export type MediumVerdict = {
  /** true = real hand-painted exterior mural */
  ok: boolean;
  medium: string;
  issues: string[];
  confidence: number;
  raw?: string;
};

export const CLASSIFIER_PROMPT =
  "You are a strict quality inspector for exterior mural mockups. Look ONLY at the image. " +
  "Decide whether the artwork on the wall is a REAL hand-painted exterior mural (aerosol/acrylic at building scale: " +
  "overspray gradients, brush or roller texture, thick re-drawn line work, matte fully-opaque paint, no boundary where the paint ends) " +
  "or whether it is the WRONG medium (a pasted print/poster/canvas/sticker/decal, a framed picture, a rectangular panel with visible edges or white margin, " +
  "or a ghosted/semi-transparent/double-exposure overlay). " +
  'Reply with JSON ONLY: {"ok": boolean, "medium": "short label", "issues": ["..."], "confidence": 0-1}. ' +
  "ok must be false if ANY wrong-medium signal is present.";

const WRONG_LABELS = [
  "print",
  "poster",
  "canvas",
  "sticker",
  "decal",
  "framed",
  "overlay",
  "ghost",
  "transparent",
  "digital",
  "collage",
  "photo",
];

/** Parse the classifier's reply. Unparseable text degrades to "unknown", never a hard fail. */
export function parseMediumVerdict(text: string | null | undefined): MediumVerdict | null {
  if (!text || !text.trim()) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const medium = typeof o.medium === "string" ? o.medium : "unknown";
  const issues = Array.isArray(o.issues)
    ? o.issues.filter((i): i is string => typeof i === "string")
    : [];
  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence)
      ? Math.min(1, Math.max(0, o.confidence))
      : 0;
  // Trust an explicit false; also fail an "ok:true" whose own label betrays it.
  const labelLooksWrong = WRONG_LABELS.some((w) => medium.toLowerCase().includes(w));
  const ok = o.ok === true && !labelLooksWrong && issues.length === 0;
  return { ok, medium, issues, confidence, raw: text.slice(0, 400) };
}

export type ClassifierDeps = {
  fetchImpl?: typeof fetch;
  model?: string;
};

/** Run the classifier against a rendered image. Returns null when it could not run. */
export async function classifyRenderedMedium(
  imageUrl: string,
  apiKey: string,
  deps: ClassifierDeps = {},
): Promise<MediumVerdict | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: deps.model ?? "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: CLASSIFIER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return parseMediumVerdict(data?.choices?.[0]?.message?.content ?? null);
  } catch {
    return null;
  }
}
