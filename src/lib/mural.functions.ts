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

async function generateOne(
  scene: Scene,
  artworkDataUrl: string,
  wallDataUrl: string | null,
  variant: "base" | "retry",
): Promise<{ id: Scene["id"]; name: string; imageUrl: string | null; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { id: scene.id, name: scene.name, imageUrl: null, error: "LOVABLE_API_KEY not configured" };
  }

  const scenePrompt = wallDataUrl
    ? variant === "base"
      ? scene.wallBasePrompt
      : scene.wallRetryPrompt
    : variant === "base"
      ? scene.basePrompt
      : scene.retryPrompt;

  const prompt = `${STYLE_LOCK}\n\nSCENE: ${scenePrompt}`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  content.push({ type: "image_url", image_url: { url: artworkDataUrl } });
  if (wallDataUrl) {
    content.push({ type: "image_url", image_url: { url: wallDataUrl } });
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      const msg =
        res.status === 429
          ? "Rate limit — please wait a moment."
          : res.status === 402
            ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
            : `Gateway error ${res.status}`;
      console.error(`[${scene.id}] ${msg}: ${text}`);
      return { id: scene.id, name: scene.name, imageUrl: null, error: msg };
    }

    const data = await res.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!imageUrl) {
      return { id: scene.id, name: scene.name, imageUrl: null, error: "No image returned" };
    }
    return { id: scene.id, name: scene.name, imageUrl };
  } catch (err) {
    console.error(`[${scene.id}] failed`, err);
    return {
      id: scene.id,
      name: scene.name,
      imageUrl: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export const generateMurals = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      artworkDataUrl: string;
      wallDataUrl?: string | null;
      variant?: "base" | "retry";
    }) => {
      if (!input?.artworkDataUrl || typeof input.artworkDataUrl !== "string") {
        throw new Error("artworkDataUrl required");
      }
      if (!input.artworkDataUrl.startsWith("data:image/")) {
        throw new Error("artworkDataUrl must be a data:image/* URL");
      }
      if (input.wallDataUrl && !input.wallDataUrl.startsWith("data:image/")) {
        throw new Error("wallDataUrl must be a data:image/* URL");
      }
      return {
        artworkDataUrl: input.artworkDataUrl,
        wallDataUrl: input.wallDataUrl ?? null,
        variant: input.variant ?? "base",
      };
    },
  )
  .handler(async ({ data }) => {
    const results = await Promise.all(
      SCENES.map((s) => generateOne(s, data.artworkDataUrl, data.wallDataUrl, data.variant)),
    );
    return { murals: results };
  });
