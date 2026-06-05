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
      "Use the SECOND provided image as the exact wall/background. Do NOT replace, restyle, or invent a new wall — preserve its real surface, texture, color, weathering, lighting, and surroundings 1:1. Composite the first artwork onto this wall as a hand-painted mural, occupying a natural rectangular region of the wall. The wall's surface texture (bricks, concrete, rust, panels, mortar lines, stains, cracks) must bleed through the paint at ~5% opacity. Match the wall's existing lighting direction, shadows, and color temperature on the painted area. Camera framing should match the wall photo. Photorealistic, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same wall photo, same mural — but slightly recompose: shift virtual camera ~20° and tilt elevation ~10°, with warmer late-afternoon directional light raking across the wall and longer cast shadows. Keep the wall's real texture and surroundings intact. Photorealistic, no text.",
  },
  {
    id: "corner",
    name: "Scene B — Angled",
    basePrompt:
      "Place the provided artwork as a hand-painted mural that wraps across a 90° outdoor corner of a weathered red brick building. The composition continues seamlessly across both wall planes with correct vanishing-point perspective and warp at the seam. Mortar lines and brick texture break through the paint at ~5% opacity. Soft overcast daylight, camera positioned 3 meters from the corner showing both faces equally, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same dual-plane brick corner mural, but recompose: drop camera elevation to street level, rotate viewpoint 25° clockwise, warm late-day directional light from camera-left casting hard shadows. Photorealistic, no text.",
    wallBasePrompt:
      "Use the SECOND provided image as the exact wall/background — keep its real surface, texture, color, lighting, and surroundings 1:1. Composite the first artwork onto this wall as a hand-painted mural at a stronger oblique angle (camera ~35° off-axis from the wall, eye level, 35mm lens) so the mural appears foreshortened with correct vanishing-point perspective on the wall plane. The wall texture must bleed through the paint at ~5% opacity. Match the wall's existing light direction and shadow color on the painted area. Photorealistic, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same wall photo, same mural at an oblique angle — recompose with a lower street-level camera, rotate viewpoint ~25° clockwise, and add warm directional light from camera-left casting hard shadows along the wall texture. Preserve the wall's real surroundings. Photorealistic, no text.",
  },
  {
    id: "concrete",
    name: "Scene C — Obstructed",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on a large weathered concrete facade in an urban back-alley. A wooden utility pole with hanging black power lines crosses in front of the mural, casting sharp diagonal shadows directly onto the painted surface. Concrete texture, stains and small cracks read through the paint at ~5% opacity. Midday sun, camera angle straight-on with slight 10° tilt, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same obstructed concrete facade mural, but recompose: shift camera 40° to the right, raise sun angle to early morning casting long cool-blue shadows, increase concrete weathering and water staining. Photorealistic, no text.",
    wallBasePrompt:
      "Use the SECOND provided image as the exact wall/background — keep its real surface, texture, color, lighting, and surroundings 1:1. Composite the first artwork onto this wall as a hand-painted mural, then add a realistic urban obstruction in the foreground: a wooden utility pole with hanging black power lines crossing in front of the wall, casting sharp diagonal shadows onto the painted surface. The wall's texture must bleed through the paint at ~5% opacity. Match the wall's existing lighting and color temperature. Photorealistic, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same wall photo, same mural with foreground utility pole + power lines — recompose: shift camera ~40° to the right so the pole's shadow falls across the lower-left of the mural, raise sun angle to early morning with long cool-blue shadows. Preserve the wall's real surroundings. Photorealistic, no text.",
  },
];

const STYLE_LOCK =
  "CRITICAL: The mural artwork (first image) must match its reference 1:1 — preserve the exact composition, line work, color palette, and every detail. Do not stylize, simplify, or redraw the artwork. Render it as if a skilled muralist hand-painted an exact reproduction onto the wall, with the wall's surface texture subtly bleeding through the paint at roughly 5% opacity.";

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
