/**
 * Wall projection mapping.
 *
 * Image models place murals badly when only told "paint on the wall": they
 * pick the wrong surface, spill onto sky/ground, or float the art off the
 * plane. This module (1) measures the wall photo with a vision pass — the
 * paintable quad's four corners and the occluders in front of it — (2) solves
 * a concrete target quad for the mural inside it (margins, aspect, scale) and
 * emits it as hard pixel-fraction coordinates in the prompt, and (3) verifies
 * the rendered image afterwards so off-wall results are re-rendered.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type Pt = { x: number; y: number };
export type Quad = { tl: Pt; tr: Pt; br: Pt; bl: Pt };
export type Box = { x: number; y: number; w: number; h: number; label: string };

export type WallGeometry = {
  surface: string;
  quad: Quad;
  occluders: Box[];
  confidence: number;
};

export const WALL_PROMPT =
  "You are a projection-mapping technician. In this photo find the SINGLE largest flat (or gently curved) wall surface " +
  "suitable for a painted mural. Return the four corners of its CLEAN PAINTABLE AREA as fractions 0-1 of the image width/height " +
  "(x right, y down) — exclude sky, ground, roof line, windows, doors, signage and anything that is not that wall. Corners follow the " +
  "wall's real perspective (a receding wall is a trapezoid). Also list objects standing IN FRONT of that wall (poles, wires, cars, " +
  "trees, people, pipes) as boxes. Reply JSON ONLY: " +
  '{"surface":"short description","quad":{"tl":{"x":0,"y":0},"tr":{"x":1,"y":0},"br":{"x":1,"y":1},"bl":{"x":0,"y":1}},' +
  '"occluders":[{"x":0,"y":0,"w":0.1,"h":0.1,"label":"pole"}],"confidence":0-1}';

const c01 = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;

function pt(v: unknown): Pt | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = c01(o.x);
  const y = c01(o.y);
  return x === null || y === null ? null : { x, y };
}

const area = (q: Quad) => {
  const p = [q.tl, q.tr, q.br, q.bl];
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % 4]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};

/** Parse + sanity-check the vision reply. Degenerate quads → null. */
export function parseWallGeometry(text: string | null | undefined): WallGeometry | null {
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]);
  } catch {
    return null;
  }
  const q = (o.quad ?? {}) as Record<string, unknown>;
  const tl = pt(q.tl);
  const tr = pt(q.tr);
  const br = pt(q.br);
  const bl = pt(q.bl);
  if (!tl || !tr || !br || !bl) return null;
  const quad: Quad = { tl, tr, br, bl };
  // Must be ordered (left corners left of right corners, top above bottom) and
  // big enough to hold a mural.
  if (tl.x >= tr.x || bl.x >= br.x || tl.y >= bl.y || tr.y >= br.y) return null;
  if (area(quad) < 0.04) return null;
  const occluders: Box[] = Array.isArray(o.occluders)
    ? (o.occluders as unknown[]).flatMap((b) => {
        const r = (b ?? {}) as Record<string, unknown>;
        const x = c01(r.x);
        const y = c01(r.y);
        const w = c01(r.w);
        const h = c01(r.h);
        if (x === null || y === null || !w || !h) return [];
        return [{ x, y, w, h, label: typeof r.label === "string" ? r.label : "object" }];
      })
    : [];
  return {
    surface: typeof o.surface === "string" ? o.surface : "wall",
    quad,
    occluders,
    confidence: c01(o.confidence) ?? 0,
  };
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Bilinear map from wall-local (u,v ∈ 0..1) to image coords. */
export function mapUV(q: Quad, u: number, v: number): Pt {
  return lerp(lerp(q.tl, q.tr, u), lerp(q.bl, q.br, u), v);
}

/**
 * Solve the mural's target quad inside the paintable quad: 10% margins,
 * ~65% of the area, artwork aspect preserved, focal band slightly above centre.
 */
export function solveMuralQuad(wall: Quad, artAspect = 1, imageAspect = 4 / 3): Quad {
  const wallW = ((wall.tr.x - wall.tl.x + (wall.br.x - wall.bl.x)) / 2) * imageAspect;
  const wallH = (wall.bl.y - wall.tl.y + (wall.br.y - wall.tr.y)) / 2;
  const wallAspect = wallW / wallH;
  const maxU = 0.8;
  const maxV = 0.8;
  let u = maxU;
  let v = (u * wallAspect) / artAspect;
  if (v > maxV) {
    v = maxV;
    u = (v * artAspect) / wallAspect;
  }
  const u0 = (1 - u) / 2;
  const v0 = Math.max(0.1, (1 - v) / 2 - 0.04);
  return {
    tl: mapUV(wall, u0, v0),
    tr: mapUV(wall, u0 + u, v0),
    br: mapUV(wall, u0 + u, v0 + v),
    bl: mapUV(wall, u0, v0 + v),
  };
}

const f = (p: Pt) => `(${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%)`;

export const PROJECTION_MARKER = "PROJECTION TARGET";

export function buildProjectionRule(
  g: WallGeometry | null,
  artAspect = 1,
  imageAspect = 4 / 3,
): string {
  if (!g) {
    return `${PROJECTION_MARKER} (no measurement available): identify the single largest clean wall plane in the photo and keep 100% of the paint inside it. Never paint on sky, ground, vehicles, windows or neighbouring structures; if unsure, paint smaller and more central on the wall.`;
  }
  const m = solveMuralQuad(g.quad, artAspect, imageAspect);
  const occ = g.occluders.length
    ? ` Objects in front of the wall that must stay in front of the paint: ${g.occluders
        .slice(0, 6)
        .map((o) => `${o.label} at x ${Math.round(o.x * 100)}-${Math.round((o.x + o.w) * 100)}%`)
        .join("; ")}.`
    : "";
  return (
    `${PROJECTION_MARKER} (measured from the wall photo — coordinates are % of image width, % of image height, origin top-left): ` +
    `the paintable surface is "${g.surface}" bounded by TL ${f(g.quad.tl)}, TR ${f(g.quad.tr)}, BR ${f(g.quad.br)}, BL ${f(g.quad.bl)}. ` +
    `Paint the mural INSIDE the quad TL ${f(m.tl)}, TR ${f(m.tr)}, BR ${f(m.br)}, BL ${f(m.bl)} — this quad already follows the wall's perspective; ` +
    `warp the artwork onto it like a projector keystoned to the wall. ZERO paint pixels outside the paintable surface bounds. ` +
    `Every other pixel of the photo stays identical.${occ}`
  );
}

async function vision(prompt: string, imageUrl: string, key: string, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    return d.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function analyzeWallGeometry(
  wallDataUrl: string,
  key: string,
  fetchImpl?: typeof fetch,
) {
  return parseWallGeometry(await vision(WALL_PROMPT, wallDataUrl, key, fetchImpl));
}

export type PlacementVerdict = { ok: boolean; issues: string[] };

export function parsePlacementVerdict(text: string | null | undefined): PlacementVerdict | null {
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const issues = Array.isArray(o.issues)
      ? o.issues.filter((i): i is string => typeof i === "string")
      : [];
    return { ok: o.onWall === true && issues.length === 0, issues };
  } catch {
    return null;
  }
}

/** Post-render check: is all the paint actually on the wall plane? */
export async function verifyPlacement(
  renderedUrl: string,
  g: WallGeometry | null,
  key: string,
  fetchImpl?: typeof fetch,
): Promise<PlacementVerdict | null> {
  const bounds = g
    ? ` The intended paintable wall is bounded by TL ${f(g.quad.tl)}, TR ${f(g.quad.tr)}, BR ${f(g.quad.br)}, BL ${f(g.quad.bl)} (% of image).`
    : "";
  const prompt =
    "Inspect this mural mockup photo. Is the painted artwork entirely ON a real wall surface, following that wall's perspective?" +
    bounds +
    ' Report issues such as: paint on sky, ground or vehicles; art floating in front of the wall; art on the wrong building; art crossing a window or wall edge; perspective not matching the wall. Reply JSON ONLY: {"onWall": boolean, "issues": ["..."]}';
  return parsePlacementVerdict(await vision(prompt, renderedUrl, key, fetchImpl));
}

/** Read width/height from a PNG/JPEG data URL header without decoding. */
export function dataUrlAspect(dataUrl: string): number | null {
  try {
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1, dataUrl.indexOf(",") + 1 + 200000);
    const bin = atob(b64.slice(0, b64.length - (b64.length % 4)));
    const u = (i: number) => bin.charCodeAt(i);
    if (u(0) === 0x89 && u(1) === 0x50) {
      const w = (u(16) << 24) | (u(17) << 16) | (u(18) << 8) | u(19);
      const h = (u(20) << 24) | (u(21) << 16) | (u(22) << 8) | u(23);
      return w && h ? w / h : null;
    }
    if (u(0) === 0xff && u(1) === 0xd8) {
      let i = 2;
      while (i < bin.length - 9) {
        if (u(i) !== 0xff) return null;
        const mk = u(i + 1);
        const len = (u(i + 2) << 8) | u(i + 3);
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
          const h = (u(i + 5) << 8) | u(i + 6);
          const w = (u(i + 7) << 8) | u(i + 8);
          return w && h ? w / h : null;
        }
        i += 2 + len;
      }
    }
  } catch {
    /* fallthrough */
  }
  return null;
}
