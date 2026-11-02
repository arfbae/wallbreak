/**
 * Pre-render artwork isolation analysis.
 *
 * Uploads are rarely clean artwork files — people drop in phone photos of a
 * canvas, screenshots with browser chrome, sketchbook pages on a table. Before
 * we ask the renderer to paint anything we send each upload to a vision model
 * and ask it to locate the actual artwork, describe the subject, and say what
 * must be discarded (background, frame, UI, hands, glare...). The result is
 * folded into the render prompt as an explicit isolation instruction.
 */

import {
  GRAFFITI_ANALYSIS_GUIDANCE,
  graffitiAnalysisRule,
  parseGraffitiAnalysis,
  type GraffitiAnalysis,
} from "./graffiti-style";

export type ArtworkSourceKind =
  | "clean-artwork" // already an isolated artwork file
  | "photo-of-artwork" // camera photo of a canvas/page/wall
  | "screenshot" // screen capture, may contain UI chrome
  | "scene-with-artwork" // artwork somewhere inside a wider scene
  | "unclear";

export type BBox = { x: number; y: number; w: number; h: number };

export type ArtworkAnalysis = {
  kind: ArtworkSourceKind;
  /** Normalised 0-1 bounds of the artwork inside the uploaded image. */
  bbox: BBox | null;
  /** Short description of the main subject to keep. */
  subject: string;
  /** Whether surrounding pixels must be discarded before painting. */
  removeBackground: boolean;
  /** Things that must NOT be painted (frame, table, cursor, hand, glare...). */
  discard: string[];
  confidence: number;
  /** false = isolated subject on blank/white/transparent ground (no backdrop of its own). */
  hasOwnBackground?: boolean | null;
  graffiti?: GraffitiAnalysis | null;
  raw?: string;
};

export const ISOLATION_PROMPT =
  "You are preparing an artwork file for mural production. Look at the image and isolate the ARTWORK itself " +
  "from everything around it. Determine: what kind of source this is (a clean artwork file, a camera photo of a " +
  "canvas/paper/print, a screenshot, or an artwork inside a wider scene); the tight normalised bounding box of the " +
  "artwork (x, y, w, h as fractions 0-1 of the image); a short description of the main subject; whether surrounding " +
  "pixels must be discarded; and a list of elements that must NOT be treated as part of the artwork (photo background, " +
  "table or floor, frame or mount, paper edges, hands or fingers, easel, browser or app UI, cursors, toolbars, " +
  "watermarks, glare or shadows falling on the artwork, perspective keystone). " +
  "Also say whether the artwork has a background of its OWN (hasOwnBackground): true when the artist painted or drew a backdrop — " +
  "scenery, colour field, wash, gradient, pattern, cloud or halo; false when the subject sits alone on blank paper, plain white, " +
  "flat empty colour, a checkerboard or a transparent cut-out. " +
  'Reply with JSON ONLY: {"kind": "clean-artwork|photo-of-artwork|screenshot|scene-with-artwork|unclear", ' +
  '"bbox": {"x":0,"y":0,"w":1,"h":1}, "subject": "short description", "removeBackground": boolean, ' +
  '"discard": ["..."], "confidence": 0-1, "hasOwnBackground": boolean, "graffiti": {"style":"throw-up|straight-letter|standard-piece|character-piece|not-graffiti|unclear", "text":null, "textConfidence":0, "layers":[], "extrusion":"none|parallel|converging|unclear", "characterIntegration":"", "preservationNotes":[]}}.\n' +
  GRAFFITI_ANALYSIS_GUIDANCE;

const KINDS: ArtworkSourceKind[] = [
  "clean-artwork",
  "photo-of-artwork",
  "screenshot",
  "scene-with-artwork",
  "unclear",
];

function clamp01(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function parseBBox(value: unknown): BBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const x = clamp01(o.x);
  const y = clamp01(o.y);
  const w = clamp01(o.w);
  const h = clamp01(o.h);
  if (x === null || y === null || w === null || h === null) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/** Parse the analyser reply. Unparseable output degrades to null, never a hard fail. */
export function parseArtworkAnalysis(text: string | null | undefined): ArtworkAnalysis | null {
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

  const kind: ArtworkSourceKind =
    typeof o.kind === "string" && (KINDS as string[]).includes(o.kind)
      ? (o.kind as ArtworkSourceKind)
      : "unclear";
  const bbox = parseBBox(o.bbox);
  const subject = typeof o.subject === "string" && o.subject.trim() ? o.subject.trim() : "";
  const discard = Array.isArray(o.discard)
    ? o.discard.filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    : [];
  const confidence = clamp01(o.confidence) ?? 0;

  // A tight crop or a non-clean source always implies the surroundings go.
  const cropped = bbox ? bbox.w < 0.98 || bbox.h < 0.98 : false;
  const removeBackground =
    o.removeBackground === true || kind !== "clean-artwork" || cropped || discard.length > 0;

  return {
    kind,
    bbox,
    subject,
    removeBackground,
    discard,
    confidence,
    hasOwnBackground: typeof o.hasOwnBackground === "boolean" ? o.hasOwnBackground : null,
    graffiti: parseGraffitiAnalysis(o.graffiti),
    raw: text.slice(0, 400),
  };
}

export type AnalysisDeps = {
  fetchImpl?: typeof fetch;
  model?: string;
};

/** Analyse one uploaded artwork. Returns null when the check could not run. */
export async function analyzeArtworkSource(
  imageDataUrl: string,
  apiKey: string,
  deps: AnalysisDeps = {},
): Promise<ArtworkAnalysis | null> {
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
              { type: "text", text: ISOLATION_PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return parseArtworkAnalysis(data?.choices?.[0]?.message?.content ?? null);
  } catch {
    return null;
  }
}

/** True only when the analyser positively found no backdrop in the artwork. */
export function needsGeneratedBackdrop(a: ArtworkAnalysis | null | undefined): boolean {
  return !!a && a.hasOwnBackground === false;
}

export const GENERATED_BACKDROP_RULE =
  "GENERATED BACKDROP (artwork has no background of its own): do not leave the subject floating on bare wall. Paint a dynamic, " +
  "cohesive mural backdrop behind it, designed as part of the same piece: build it from the artwork's own palette (its dominant " +
  "hues plus one or two accents, harmonised with the wall's existing colour and the scene lighting), and echo the artwork's style " +
  "and line language — flowing aerosol colour fades, sweeping energy shapes, abstract organic or geometric forms derived from motifs " +
  "already in the subject, soft halos or clouds for graffiti — with depth and movement that leads the eye to the subject so it stays " +
  "the clear hero. The backdrop lives inside the same paintable wall area and projection target, ends in loose hand-painted organic " +
  "edges (never a rectangle, panel or frame), introduces no new figures, characters, text, logos or recognisable objects, and never " +
  "covers, recolours or restyles the subject. When several artworks share one mural, paint ONE continuous backdrop that unifies them.";

function backdropLine(a: ArtworkAnalysis | null, i: number): string | null {
  return needsGeneratedBackdrop(a)
    ? `Artwork ${i + 1} has no background of its own — apply the GENERATED BACKDROP rule to it.`
    : null;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Turn the per-image analyses into the prompt's isolation instruction. Always
 * emits the baseline rule so the renderer is protected even when the analyser
 * was unavailable.
 */
export function buildIsolationRule(
  analyses: Array<ArtworkAnalysis | null>,
  keepBackground = false,
): string {
  if (keepBackground) {
    const keepLines = [
      "ARTWORK ISOLATION (keep-background mode): treat the supplied artwork image as a COMPLETE composition — its background, " +
        "washes, fields of colour and atmospheric areas are part of the artwork and MUST be painted along with the main subject. " +
        "Do not cut the subject out, do not drop the backdrop, do not silhouette anything. Only discard elements that clearly belong to " +
        "the photograph of the artwork rather than the artwork itself: frames and mounts, table or floor around the sheet, hands or fingers, " +
        "easel parts, browser or app UI, toolbars, cursors, menu bars, file names, watermarks and platform logos, plus glare, cast shadows and " +
        "colour casts from room lighting. Correct perspective keystone so the artwork reads square-on, and let the painted composition fill its " +
        "wall area edge to edge rather than sitting inside a pasted rectangle.",
    ];
    analyses.forEach((a, i) => {
      if (!a) return;
      const parts: string[] = [`Artwork ${i + 1}: source reads as ${a.kind.replace(/-/g, " ")}`];
      if (a.subject) parts.push(`main subject = ${a.subject}`);
      if (a.bbox && (a.bbox.w < 0.98 || a.bbox.h < 0.98)) {
        parts.push(
          `the artwork occupies region x ${pct(a.bbox.x)}-${pct(a.bbox.x + a.bbox.w)}, y ${pct(
            a.bbox.y,
          )}-${pct(a.bbox.y + a.bbox.h)} of that image — paint that whole region, background included`,
        );
      }
      if (a.discard.length > 0) {
        parts.push(`still do not paint: ${a.discard.slice(0, 8).join(", ")}`);
      }
      keepLines.push(`${parts.join("; ")}.`);
      const backdrop = backdropLine(a, i);
      if (backdrop) keepLines.push(backdrop);
      const graffiti = graffitiAnalysisRule(a.graffiti, i);
      if (graffiti) keepLines.push(graffiti);
    });
    if (analyses.some(needsGeneratedBackdrop)) keepLines.push(GENERATED_BACKDROP_RULE);
    return keepLines.join("\n");
  }
  const lines = [
    "ARTWORK ISOLATION (apply before any paint is placed): the supplied artwork image may not be a clean artwork file — " +
      "it can be a camera photo of a canvas or sketchbook, a screenshot, or the artwork sitting inside a wider scene. " +
      "Identify the MAIN ARTWORK SUBJECT and paint ONLY that. Everything surrounding it is source material to be discarded, never painted: " +
      "photographic background, table, floor, easel or wall behind the artwork, paper or canvas edges, mounts, frames and passe-partouts, " +
      "hands, fingers, shadows and glare falling across the artwork, colour casts from room lighting, browser or app UI, toolbars, cursors, " +
      "menu bars, scrollbars, status bars, file names, watermarks and platform logos. " +
      "Correct any perspective keystone or lens distortion so the artwork reads square-on, neutralise the photo's colour cast back to the " +
      "artwork's true palette, and take the artwork's own silhouette as the painted shape — no rectangular crop edge, no cut-out outline, " +
      "no residual background halo around the subject.",
  ];

  analyses.forEach((a, i) => {
    if (!a) return;
    const parts: string[] = [`Artwork ${i + 1}: source reads as ${a.kind.replace(/-/g, " ")}`];
    if (a.subject) parts.push(`main subject = ${a.subject}`);
    if (a.bbox && (a.bbox.w < 0.98 || a.bbox.h < 0.98)) {
      parts.push(
        `use only the region x ${pct(a.bbox.x)}-${pct(a.bbox.x + a.bbox.w)}, y ${pct(a.bbox.y)}-${pct(
          a.bbox.y + a.bbox.h,
        )} of that image`,
      );
    }
    if (a.removeBackground) parts.push("discard its surrounding background entirely");
    if (a.discard.length > 0) parts.push(`do not paint: ${a.discard.slice(0, 8).join(", ")}`);
    lines.push(`${parts.join("; ")}.`);
    const backdrop = backdropLine(a, i);
    if (backdrop) lines.push(backdrop);
    const graffiti = graffitiAnalysisRule(a.graffiti, i);
    if (graffiti) lines.push(graffiti);
  });

  if (analyses.some(needsGeneratedBackdrop)) lines.push(GENERATED_BACKDROP_RULE);
  return lines.join("\n");
}
