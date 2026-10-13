/** Distilled from the supplied graffiti references; guidance, not an OCR/segmentation engine. */
export const GRAFFITI_ANALYSIS_GUIDANCE = `GRAFFITI STRUCTURAL ANALYSIS: Apply only when graffiti lettering or a character piece is actually visible; otherwise report style "not-graffiti". Distinguish throw-up (rounded inflated lobes, compressed kerning, blind dividing strokes, suppressed counters, economical palette), straight-letter (readable stems, baseline/cap-height, sharp corners, deliberate shear or exaggerated anatomy), standard-piece (layered fills, keylines/inlines, painted depth, halo, shared spines and biting), and character-piece (figures wrapping around letters, replacing strokes or anchoring on a baseline). Use "unclear" rather than guessing.
Inspect background cloud, painted shadow/extrusion, fill, keyline, inline/highlights and force-field separately. A shared spine, blind incision or figurative substitution is not a broken letter. Read text only when clearly legible; never invent a word from contextual guesses. Distinguish parallel/isometric extrusion from converging extrusion; these are painted illusions, not the camera perspective of the target wall. Record character/letter overlap order, keyline weight, palette and light direction. Decorative clouds, halos and painted depth can be intentional parts of the artwork, not photographic clutter. This is qualitative visual analysis, not a measured segmentation mask or trained graph reconstruction.`;

export const GRAFFITI_RENDER_GUIDANCE = `GRAFFITI STRUCTURE PRESERVATION (conditional: only for graffiti artwork): Preserve the reference's style instead of imposing graffiti on unrelated images. Throw-ups retain rounded lobes, economical fills, heavy keylines, tight kerning and blind dividing strokes; do not add conventional counters. Straight letters retain deliberate baseline/cap-height relationships, sharp joinery, consistent bar widths and intentional leans. Standard pieces retain fill boundaries, inlines, shared spines, biting, bridges and painted extrusion geometry; do not flatten complex lettering into generic fonts. Character pieces retain their anatomical substitutions, wraps and foreground/background interlocks. Preserve legible reference text exactly; never guess, rewrite or invent lettering when unreadable.
Keep painted depth internally coherent: parallel extrusion vectors remain parallel; converging vectors retain their artwork vanishing point. Project the ENTIRE artwork onto the measured wall plane separately; painted 3D never licenses paint outside the wall or alters the wall photo. Painted shadows, chrome highlights and halos already inside the design are pigment illusions, not physical floating objects, glossy finishes or pasted-image drop shadows. Keep chrome's light/dark split inside fills and retain intentional counter holes and dividing strokes.
Character and letter outlines should retain the reference's coordinated keyline weight, shared palette and painted light direction. In combined artwork layouts use restrained palette echoes, compatible keyline rhythm and overlap order without recolouring original subjects, rewriting letters, replacing strokes or introducing new characters. When backgrounds are kept preserve intentional clouds, washes and force-fields. When backgrounds are removed omit backdrop clouds/washes but preserve structural keylines, inlines, counters and painted extrusion attached to the subject. Source-photo frames, UI and room clutter are never artwork. These rules never override subject fidelity, the background choice, wall containment or foreground occlusion.`;

export type GraffitiStyle =
  | "throw-up"
  | "straight-letter"
  | "standard-piece"
  | "character-piece"
  | "not-graffiti"
  | "unclear";

export type GraffitiAnalysis = {
  style: GraffitiStyle;
  text: string | null;
  textConfidence: number;
  layers: string[];
  extrusion: "none" | "parallel" | "converging" | "unclear";
  characterIntegration: string;
  preservationNotes: string[];
};

const styles: GraffitiStyle[] = [
  "throw-up", "straight-letter", "standard-piece", "character-piece", "not-graffiti", "unclear",
];
const list = (v: unknown): string[] => Array.isArray(v)
  ? v.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
      .slice(0, 8).map((s) => s.trim().slice(0, 200))
  : [];

export function parseGraffitiAnalysis(value: unknown): GraffitiAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const style = styles.find((s) => s === o.style) ?? "unclear";
  const textConfidence = typeof o.textConfidence === "number" && Number.isFinite(o.textConfidence)
    ? Math.max(0, Math.min(1, o.textConfidence)) : 0;
  const extrusion = (["none", "parallel", "converging", "unclear"] as const)
    .find((s) => s === o.extrusion) ?? "unclear";
  return {
    style,
    text: style !== "not-graffiti" && textConfidence >= 0.9 && typeof o.text === "string"
      ? o.text.trim().slice(0, 100) || null : null,
    textConfidence,
    layers: list(o.layers),
    extrusion,
    characterIntegration: typeof o.characterIntegration === "string"
      ? o.characterIntegration.trim().slice(0, 300) : "",
    preservationNotes: list(o.preservationNotes),
  };
}

export function graffitiAnalysisRule(analysis: GraffitiAnalysis | null | undefined, index: number): string {
  if (!analysis || analysis.style === "not-graffiti" || analysis.style === "unclear") return "";
  return [
    `Artwork ${index + 1} graffiti analysis (advisory; the image is authoritative): ${analysis.style}.`,
    analysis.text ? `Clearly legible reference lettering: ${JSON.stringify(analysis.text)}; preserve exactly.`
      : "Lettering is not confidently readable; preserve the visible shapes, do not guess a word.",
    analysis.layers.length ? `Visible layers: ${analysis.layers.join(", ")}.` : "",
    `Painted extrusion: ${analysis.extrusion}; independent of target wall camera perspective.`,
    analysis.characterIntegration ? `Character integration: ${analysis.characterIntegration}.` : "",
    analysis.preservationNotes.length ? `Preserve: ${analysis.preservationNotes.join("; ")}.` : "",
  ].filter(Boolean).join(" ");
}