import { createServerFn } from "@tanstack/react-start";

type Scene = {
  id: "container" | "corner" | "concrete";
  name: string;
  basePrompt: string;
  retryPrompt: string;
  wallBasePrompt: string;
  wallRetryPrompt: string;
};

const SCENES: Scene[] = [
  {
    id: "container",
    name: "Scene A — Frontal",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on the side of a weathered, rusted corrugated shipping container in an industrial dockyard at golden hour. The paint must flow into the corrugated ridges and valleys of the steel — pigment pools in the troughs and stretches across the ribs. Slight flaking and rust patches show through the paint at ~5% opacity. Camera angle 35° to the right of the wall, eye level, 35mm lens, photorealistic, no text, no watermarks, no UI.",
    retryPrompt:
      "Same industrial shipping container scene, but recompose: camera angle 50° to the left, lower elevation 15°, late-afternoon warm key light from camera-right, longer cast shadows from the container ridges. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo, pixel-for-pixel, with ONLY the painted mural added on top of its primary wall surface. Do NOT redraw, restyle, recolor, relight, re-crop, or replace the wall, sky, ground, surroundings, or any other element of the photo. Identify the largest flat paintable wall plane in the photo and place the first image as a hand-painted mural confined to that plane, conforming to its perspective, vanishing points, and surface curvature. The wall's real texture, mortar lines, panel seams, cracks, stains, dirt, and existing surface lighting MUST visibly read through the paint at ~8% opacity. Light the painted area using the EXACT same direction, hardness, and color temperature already present in the photo — match existing highlights and shadows on adjacent surfaces. Add subtle, physically correct shading where real foreground objects (poles, signs, vegetation, wires) occlude the mural; never erase those objects. Framing must remain identical to the source photo. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural locked to the same wall plane — but subtly recompose lighting only: shift the painted-area highlights to suggest warmer late-afternoon raking light from the same direction already in the photo, deepen existing shadows slightly. Do NOT change camera, crop, wall, surroundings, or replace the photo. Keep the wall's real texture bleeding through at ~8% opacity. Photorealistic, no text.",
  },
  {
    id: "corner",
    name: "Scene B — Angled",
    basePrompt:
      "Place the provided artwork as a hand-painted mural that wraps across a 90° outdoor corner of a weathered red brick building. The composition continues seamlessly across both wall planes with correct vanishing-point perspective and warp at the seam. Mortar lines and brick texture break through the paint at ~5% opacity. Soft overcast daylight, camera positioned 3 meters from the corner showing both faces equally, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same dual-plane brick corner mural, but recompose: drop camera elevation to street level, rotate viewpoint 25° clockwise, warm late-day directional light from camera-left casting hard shadows. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo unchanged except for one addition: render the first image as a hand-painted mural on the primary wall plane, but framed/cropped tighter so the mural occupies more of the frame at an oblique reading angle (the mural itself appears foreshortened along the wall's existing perspective lines). Do NOT replace the wall, sky, ground, or surroundings. Mortar lines, panel seams, surface cracks, stains, and dirt from the real wall MUST read through the paint at ~8% opacity. Light the painted area using the SAME direction, hardness, and color temperature already in the photo. Respect any real foreground occluders. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural on the same wall plane — recompose only the painted area's lighting: warmer directional light from the same source already in the photo, harder shadows along existing wall texture. Do NOT alter the photo, camera, crop, or surroundings. Keep texture bleed at ~8% opacity. Photorealistic, no text.",
  },
  {
    id: "concrete",
    name: "Scene C — Obstructed",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on a large weathered concrete facade in an urban back-alley. A wooden utility pole with hanging black power lines crosses in front of the mural, casting sharp diagonal shadows directly onto the painted surface. Concrete texture, stains and small cracks read through the paint at ~5% opacity. Midday sun, camera angle straight-on with slight 10° tilt, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same obstructed concrete facade mural, but recompose: shift camera 40° to the right, raise sun angle to early morning casting long cool-blue shadows, increase concrete weathering and water staining. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo unchanged except: render the first image as a hand-painted mural on the primary wall plane AND any real foreground objects already present in the photo (utility poles, wires, signage, branches, parked cars, pedestrians, fences) must remain visibly in front of the mural with physically correct occlusion and shadows falling onto the paint. If no foreground occluder exists in the source photo, add a single thin diagonal shadow consistent with the photo's existing light direction. Do NOT replace the wall, sky, or surroundings. Real surface texture (concrete pores, cracks, water stains) MUST read through the paint at ~8% opacity. Match the photo's existing lighting and color temperature exactly. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural and same real foreground objects — recompose only the painted area's lighting: cooler early-morning quality with longer shadows from the same light direction already in the photo. Do NOT alter the photo, camera, crop, or surroundings. Keep texture bleed at ~8% opacity. Photorealistic, no text.",
  },
];

const STYLE_LOCK =
  "CRITICAL ARTWORK FIDELITY: The mural artwork (FIRST image) must match its reference 1:1 — preserve exact composition, line work, color palette, and every detail. Do not stylize, simplify, crop, or redraw it. CRITICAL BACKGROUND FIDELITY (when a SECOND image is provided): treat that second image as a fixed photographic plate. Return the same photo with only a painted mural added to its primary wall plane. Never invent a new wall, never replace the sky/ground/surroundings, never re-light the scene, never change the camera. The final image must look like the original wall photo with a real mural that was painted onto it — surface texture bleeding through paint at ~8% opacity, mural perspective conforming to the wall's existing geometry, lighting on the paint exactly matching the lighting already in the photo.";

const COMPOSITION_RULES =
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

const LAYOUT_TEMPLATES: Record<number, string[]> = {
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

type KeyEntry = { key: string; label: string };

async function tryOnce(
  key: string,
  body: string,
): Promise<{ ok: true; imageUrl: string } | { ok: false; status: number; msg: string }> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      const msg =
        res.status === 401 || res.status === 403
          ? `Auth ${res.status} — invalid/unauthorized key`
          : res.status === 429
            ? "Rate limit — please wait a moment."
            : res.status === 402
              ? "AI credits exhausted."
              : `Gateway error ${res.status}`;
      console.error(`[gateway ${res.status}] ${msg}: ${text.slice(0, 200)}`);
      return { ok: false, status: res.status, msg };
    }
    const data = await res.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!imageUrl) return { ok: false, status: 200, msg: "No image returned" };
    return { ok: true, imageUrl };
  } catch (err) {
    return { ok: false, status: 0, msg: err instanceof Error ? err.message : "Network error" };
  }
}

async function generateOne(
  scene: Scene,
  artworkDataUrls: string[],
  wallDataUrl: string | null,
  variant: "base" | "retry",
  keys: KeyEntry[],
  extraPrompt?: string,
  layoutIndex = 0,
): Promise<{ id: Scene["id"]; name: string; imageUrl: string | null; error?: string; keyUsed?: string }> {
  if (keys.length === 0) {
    return { id: scene.id, name: scene.name, imageUrl: null, error: "No API key available" };
  }

  const scenePrompt = wallDataUrl
    ? variant === "base"
      ? scene.wallBasePrompt
      : scene.wallRetryPrompt
    : variant === "base"
      ? scene.basePrompt
      : scene.retryPrompt;

  const n = artworkDataUrls.length;
  const templates = LAYOUT_TEMPLATES[n];
  const layout = templates ? templates[layoutIndex % templates.length] : "";

  const multi =
    n > 1
      ? `\n\nMULTI-ARTWORK COMBINATION: ${n} separate artwork images are provided (they are the first ${n} images${wallDataUrl ? ", the LAST image is the wall photo" : ""}). Incorporate ALL of them into ONE single cohesive mural on the SAME wall plane, sharing one painted background so they read as one continuous commissioned piece. Each artwork must remain individually recognisable and faithful to its reference (same composition, line work and palette); do not merge them into one hybrid creature, do not drop any of them, do not duplicate one artwork in place of another. Treat the group as a single composition: one shared baseline or deliberate offset grid, consistent relative scale, and even rhythm of negative space between pieces.\n${layout}`
      : "";

  const prompt = `${STYLE_LOCK}\n\n${COMPOSITION_RULES}${multi}\n\nSCENE: ${scenePrompt}${extraPrompt ? `\n\n${extraPrompt}` : ""}\n\nFINAL SELF-CHECK before returning the image: is every artwork fully inside the paintable wall rectangle with clean margins, at correct original aspect ratio, focal point unobstructed, edges following the wall's perspective, real foreground objects still in front, and the paint matte with wall texture reading through? If not, fix it before rendering.`;
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const a of artworkDataUrls) content.push({ type: "image_url", image_url: { url: a } });
  if (wallDataUrl) content.push({ type: "image_url", image_url: { url: wallDataUrl } });

  const body = JSON.stringify({
    model: "google/gemini-2.5-flash-image",
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
  });


  let lastMsg = "All keys failed";
  for (const entry of keys) {
    const result = await tryOnce(entry.key, body);
    if (result.ok) {
      return { id: scene.id, name: scene.name, imageUrl: result.imageUrl, keyUsed: entry.label };
    }
    lastMsg = `${entry.label}: ${result.msg}`;
    // Only fall through to next key on auth failures. Rate limit / credits / other → stop.
    if (result.status !== 401 && result.status !== 403 && result.status !== 0) {
      break;
    }
  }
  return { id: scene.id, name: scene.name, imageUrl: null, error: lastMsg };
}


export const generateMurals = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      artworkDataUrl?: string;
      artworkDataUrls?: string[];
      wallDataUrl?: string | null;
      variant?: "base" | "retry";
      apiKey?: string | null;
      apiKeys?: string[] | null;
      serverFallback?: boolean;
      mode?: "separate" | "combined";
      count?: number;
    }) => {
      const artworkList: string[] = [];
      if (Array.isArray(input.artworkDataUrls)) artworkList.push(...input.artworkDataUrls);
      if (typeof input.artworkDataUrl === "string") artworkList.push(input.artworkDataUrl);
      const artworks = artworkList
        .filter((a): a is string => typeof a === "string" && a.startsWith("data:image/"))
        .slice(0, 3);
      if (artworks.length === 0) {
        throw new Error("At least one artworkDataUrl is required (data:image/*)");
      }
      if (input.wallDataUrl && !input.wallDataUrl.startsWith("data:image/")) {
        throw new Error("wallDataUrl must be a data:image/* URL");
      }
      const raw: string[] = [];
      if (Array.isArray(input.apiKeys)) raw.push(...input.apiKeys);
      if (typeof input.apiKey === "string") raw.push(input.apiKey);
      const apiKeys = Array.from(
        new Set(raw.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)),
      );
      const mode = input.mode === "combined" ? "combined" : "separate";
      const count = Math.min(3, Math.max(1, Math.round(input.count ?? 1)));
      return {
        artworks,
        wallDataUrl: input.wallDataUrl ?? null,
        variant: input.variant ?? "base",
        apiKeys,
        serverFallback: input.serverFallback !== false,
        mode,
        count,
      };
    },
  )
  .handler(async ({ data }) => {
    const keys: KeyEntry[] = data.apiKeys.map((k, i) => ({
      key: k,
      label: `user key ${i + 1}`,
    }));

    // Server key is a metered resource: signed-in users only, rolling 24h quota.
    let quotaUserId: string | null = null;
    if (data.serverFallback && process.env.LOVABLE_API_KEY) {
      const { resolveCaller, checkServerKeyQuota, SERVER_KEY_DAILY_LIMIT } = await import(
        "./gen-guard.server"
      );
      const { userId } = await resolveCaller();
      if (userId) {
        const quota = await checkServerKeyQuota(userId);
        if (quota.allowed) {
          quotaUserId = userId;
          keys.push({ key: process.env.LOVABLE_API_KEY, label: "server key" });
        } else if (keys.length === 0) {
          throw new Error(
            `Daily limit reached (${SERVER_KEY_DAILY_LIMIT} renders / 24h on the shared key). Add your own API key to keep going, or try again later.`,
          );
        }
      } else if (keys.length === 0) {
        throw new Error("Sign in to use the shared render key, or add your own API key.");
      }
    }
    if (keys.length === 0) {
      throw new Error("No API key available. Add your own key or sign in to use the shared key.");
    }

    const meter = async <T extends { keyUsed?: string }>(results: T[]): Promise<T[]> => {
      if (!quotaUserId) return results;
      const used = results.filter((r) => r.keyUsed === "server key").length;
      const { recordServerKeyUsage } = await import("./gen-guard.server");
      await recordServerKeyUsage(quotaUserId, used);
      return results;
    };


    const VARIATIONS = [
      "COMPOSITION VARIATION 1: the balanced, canonical arrangement described in the layout instruction above.",
      "COMPOSITION VARIATION 2: keep the same wall, camera, crop and lighting, but re-solve the composition — different left-to-right order and wider rhythm of spacing, mural sitting slightly lower on the wall with more headroom above.",
      "COMPOSITION VARIATION 3: keep the same wall, camera, crop and lighting, but re-solve the composition — a clear scale hierarchy (one dominant piece, the others smaller and vertically offset) with asymmetric negative space.",
    ];

    if (data.mode === "combined") {
      const results = await Promise.all(
        Array.from({ length: data.count }, (_, i) => {
          const baseScene = data.wallDataUrl ? SCENES[0] : SCENES[i % SCENES.length];
          const sceneWithId: Scene = { ...baseScene, id: `${baseScene.id}-${i}` as Scene["id"] };
          return generateOne(
            sceneWithId,
            data.artworks,
            data.wallDataUrl,
            data.variant,
            keys,
            VARIATIONS[i],
            i,
          ).then((r) => ({ ...r, name: data.count > 1 ? `Mockup ${i + 1}` : "Combined Mural" }));
        }),
      );
      return { murals: results };
    }

    const results = await Promise.all(
      data.artworks.map((artworkDataUrl, i) => {
        // When a wall photo is provided, every mockup uses Scene A's strict
        // background-lock prompt (Scene B/C rewrite/obstruct the photo).
        const baseScene = data.wallDataUrl ? SCENES[0] : SCENES[i % SCENES.length];
        const sceneWithId: Scene = { ...baseScene, id: (`${baseScene.id}-${i}`) as Scene["id"] };
        return generateOne(sceneWithId, [artworkDataUrl], data.wallDataUrl, data.variant, keys)
          .then((r) => ({ ...r, name: `Artwork ${i + 1}` }));
      }),
    );
    return { murals: results };

  });

