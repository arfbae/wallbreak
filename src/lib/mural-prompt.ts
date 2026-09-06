/**
 * Prompt assembly + medium/style guards for mural rendering.
 *
 * Kept in its own module (no server-only imports) so the regression suite can
 * assert the assembled prompt directly.
 */

export const MEDIUM_TRANSLATION =
  "MEDIUM TRANSLATION (mandatory): the artwork must be RE-EXECUTED in real exterior mural medium — aerosol spray paint and acrylic wall paint applied by hand at building scale — not shown as the original drawing, canvas, print, poster or digital file pasted on the wall. Concretely: soft feathered aerosol gradients and visible overspray haloes on soft transitions, hard hand-cut or taped edges on graphic shapes, slight brush chatter and roller texture in large colour fields, occasional drip or run under heavy areas, thick opaque line work re-drawn at scale (never thin printed hairlines), matte non-reflective finish with zero paper grain, canvas weave, drop shadow, border, frame, white margin or rectangular edge. There must be NO visible boundary between artwork and wall — the paint simply ends where the artist stopped painting. Scale-appropriate detail: micro-details too fine to spray are simplified into painted strokes, while overall composition, subject matter and colour palette stay faithful.";

export const STYLE_LOCK =
  "CRITICAL ARTWORK FIDELITY: The mural artwork (FIRST image) keeps the SAME subject matter, composition, layout and colour palette as its reference — every subject in the artwork must appear, none added, none removed, nothing substituted with a different animal, object or scene. Do not reinterpret the subject. Fidelity applies to WHAT is depicted, while MEDIUM TRANSLATION governs HOW it is rendered. CRITICAL BACKGROUND FIDELITY (when a SECOND image is provided): treat that second image as a fixed photographic plate. Return the same photo with only a painted mural added to its primary wall plane. Never invent a new wall, never replace the sky/ground/surroundings, never re-light the scene, never change the camera. The final image must look like the original wall photo with a real mural that was painted onto it — fully opaque paint that only picks up the wall's surface relief, mural perspective conforming to the wall's existing geometry, lighting on the paint exactly matching the lighting already in the photo.";

export const ANTI_GHOST =
  "ANTI-GHOST RULE (highest priority, overrides everything else): the artwork must be REPAINTED onto the wall, not blended, overlaid, or composited on top of the photograph. Absolutely NO transparency, NO double exposure, NO ghosting, NO watermark effect, NO semi-transparent sketch lines, NO artwork pixels anywhere outside the wall plane (never across sky, ground, vehicles, machinery, trees, cranes or other buildings). The painted pigment is 100% opaque and completely hides whatever was previously on that part of the wall, including any existing mural, graffiti or signage. If the wall is a curved or multi-faceted structure (silos, tanks, columns), the artwork must wrap and foreshorten around each surface with correct curvature and shading, and must break realistically at the gaps between structures. The result must be indistinguishable from a photograph of a real painted wall.";

export const COMPOSITION_RULES =
  "COMPOSITION LOGIC (apply strictly, this governs where and how big the painted area sits):\n" +
  "1. WALL FIT — first read the wall's true paintable rectangle: exclude windows, doors, vents, drainpipes, signage, roof line and the ground/plinth strip. The mural must sit entirely inside that clean rectangle. Never let paint run over a window, door frame or off the edge of the wall.\n" +
  "2. MARGINS — leave a deliberate unpainted breathing margin of roughly 6-12% of the wall's height on all four sides. The mural must never bleed to the very edge unless the wall plane is fully bounded and flat.\n" +
  "3. SCALE — the mural occupies about 55-75% of the paintable wall area: large enough to read as a commissioned piece, never a small poster stuck on a big wall and never cramped edge-to-edge.\n" +
  "4. PLACEMENT — centre of visual mass sits on a rule-of-thirds intersection of the paintable rectangle, with the artwork's focal point (face, eyes, main subject) at roughly 55-65% of the wall height so it reads at street eye level.\n" +
  "5. ASPECT INTEGRITY — preserve the artwork's original aspect ratio exactly. Scale uniformly; never stretch, squash, rotate or crop the artwork to make it fit. If the ratios disagree, reduce scale and extend clean negative space instead.\n" +
  "6. PERSPECTIVE — the mural's rectangle is projected onto the wall's real perspective: its edges must be parallel to the wall's own mortar courses, panel seams and vanishing lines, foreshortening consistently with the photo's geometry.\n" +
  "7. OCCLUSION ORDER — real objects in front of the wall (poles, wires, pipes, plants, cars, people, signage) stay in front of the paint with correct edges and contact shadows; the mural is never painted over them.\n" +
  "8. BALANCE — no important detail of the artwork falls behind an occluder or into a deep shadow pocket; nudge the placement laterally to keep the focal point clear.\n" +
  "9. FINISH — flat exterior wall paint: matte, slightly absorbed into the substrate, no gloss, no canvas weave, no picture frame, no drop shadow, no border, no sticker or decal look.";

export const LAYOUT_TEMPLATES: Record<number, string[]> = {
  2: [
    "LAYOUT — DIPTYCH BALANCE: place the two artworks side by side on one baseline, equal visual weight, separated by a gap of about 8% of the mural width, their vertical centres aligned.",
    "LAYOUT — LEAD AND ECHO: one artwork at ~60% of the mural width anchored on the left third, the second at ~40% offset slightly higher on the right, overlapping painted background tying them together.",
    "LAYOUT — STAGGERED PAIR: artworks offset diagonally (one lower-left, one upper-right) with generous negative space on the opposing corners, still inside the paintable rectangle.",
  ],
  3: [
    "LAYOUT — FRIEZE: the three artworks in a single horizontal row along one shared baseline, even spacing, equal heights, reading left to right as one continuous band.",
    "LAYOUT — HERO AND SATELLITES: one dominant artwork at ~50% of the mural width centred slightly left, the other two smaller (~25% each) stacked vertically on the right with aligned outer edges.",
    "LAYOUT — TRIANGULAR RHYTHM: two artworks on the lower baseline and one raised between and above them, forming a stable triangle of focal points; connect with a shared painted background wash.",
  ],
};

export const FINAL_SELF_CHECK =
  "FINAL SELF-CHECK before returning the image: is the artwork fully re-executed in real exterior mural medium (aerosol/acrylic at building scale — soft overspray gradients, visible brush/roller texture, thick opaque line work re-drawn at scale, matte finish, NO paper grain/canvas weave/frame/border/white margin/rectangular edge, NO visible boundary where the paint ends), is the paint fully opaque with zero ghosting/transparency and zero artwork pixels off the wall plane, is every artwork fully inside the paintable wall rectangle with clean margins, at correct original aspect ratio, focal point unobstructed, edges following the wall's perspective, real foreground objects still in front, and the paint matte and fully opaque? If not, fix it before rendering.";

/**
 * Every marker below MUST appear in a rendered prompt. The regression suite and
 * the runtime guard both read this list.
 */
export const REQUIRED_PROMPT_MARKERS: Array<{ id: string; needle: string }> = [
  { id: "MEDIUM_TRANSLATION", needle: "MEDIUM TRANSLATION (mandatory)" },
  { id: "MEDIUM_TRANSLATION_AEROSOL", needle: "aerosol spray paint and acrylic wall paint" },
  { id: "MEDIUM_TRANSLATION_NO_PAPER", needle: "zero paper grain" },
  { id: "ANTI_GHOST", needle: "ANTI-GHOST RULE" },
  { id: "STYLE_LOCK", needle: "CRITICAL ARTWORK FIDELITY" },
  { id: "COMPOSITION_RULES", needle: "COMPOSITION LOGIC" },
  { id: "FINAL_SELF_CHECK", needle: "FINAL SELF-CHECK" },
];

export type BuildPromptInput = {
  scenePrompt: string;
  artworkCount: number;
  hasWall: boolean;
  extraPrompt?: string | undefined;
  layoutIndex?: number;
};

export function buildMuralPrompt(input: BuildPromptInput): string {
  const { scenePrompt, artworkCount: n, hasWall, extraPrompt, layoutIndex = 0 } = input;
  const templates = LAYOUT_TEMPLATES[n];
  const layout = templates ? templates[layoutIndex % templates.length] : "";

  const multi =
    n > 1
      ? `\n\nMULTI-ARTWORK COMBINATION: ${n} separate artwork images are provided (they are the first ${n} images${hasWall ? ", the LAST image is the wall photo" : ""}). Incorporate ALL of them into ONE single cohesive mural on the SAME wall plane, sharing one painted background so they read as one continuous commissioned piece. Each artwork must remain individually recognisable and faithful to its reference (same composition, line work and palette); do not merge them into one hybrid creature, do not drop any of them, do not duplicate one artwork in place of another. Treat the group as a single composition: one shared baseline or deliberate offset grid, consistent relative scale, and even rhythm of negative space between pieces.\n${layout}`
      : "";

  return `${ANTI_GHOST}\n\n${MEDIUM_TRANSLATION}\n\n${STYLE_LOCK}\n\n${COMPOSITION_RULES}${multi}\n\nSCENE: ${scenePrompt}${extraPrompt ? `\n\n${extraPrompt}` : ""}\n\n${FINAL_SELF_CHECK}`;
}

/** Markers missing from a prompt (empty array = healthy). */
export function findMissingPromptMarkers(prompt: string): string[] {
  return REQUIRED_PROMPT_MARKERS.filter((m) => !prompt.includes(m.needle)).map((m) => m.id);
}

/**
 * Runtime guard. Throws (and logs) if the assembled prompt lost a mandatory
 * rule — a broken render is better caught here than shipped to the user.
 */
export function assertPromptIntegrity(prompt: string, context: string): void {
  const missing = findMissingPromptMarkers(prompt);
  if (missing.length > 0) {
    console.error(
      `[mural:prompt-guard] FAIL ${context} — missing rules: ${missing.join(", ")} (prompt ${prompt.length} chars)`,
    );
    throw new Error(`Prompt integrity check failed: missing ${missing.join(", ")}`);
  }
  console.info(
    `[mural:prompt-guard] OK ${context} — ${REQUIRED_PROMPT_MARKERS.length} rules present, ${prompt.length} chars`,
  );
}

/**
 * Words that mean the model described the wrong medium/style back to us
 * (i.e. it treated the artwork as a pasted picture instead of paint).
 */
export const WRONG_MEDIUM_TERMS = [
  "canvas",
  "poster",
  "print",
  "sticker",
  "decal",
  "framed",
  "picture frame",
  "photograph of the artwork",
  "collage",
  "digital overlay",
  "watermark",
  "transparent overlay",
  "double exposure",
  "ghosted",
];

export type MediumCheck = { ok: boolean; offenders: string[] };

/**
 * Inspect any text the renderer returns alongside the image. Reported as a
 * warning signal, not a hard failure, because the text channel is optional.
 */
export function checkResponseMedium(responseText: string | null | undefined): MediumCheck {
  if (!responseText) return { ok: true, offenders: [] };
  const lower = responseText.toLowerCase();
  const offenders = WRONG_MEDIUM_TERMS.filter((t) => {
    const i = lower.indexOf(t);
    if (i === -1) return false;
    // ignore negated mentions like "no canvas weave" / "not a poster"
    const before = lower.slice(Math.max(0, i - 24), i);
    return !/\b(no|not|never|without|zero|avoid|neither|nor)\b[^.]*$/.test(before);
  });
  return { ok: offenders.length === 0, offenders };
}
