import { createServerFn } from "@tanstack/react-start";

type Scene = {
  id: "container" | "corner" | "concrete";
  name: string;
  basePrompt: string;
  retryPrompt: string;
};

const SCENES: Scene[] = [
  {
    id: "container",
    name: "Industrial Container",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on the side of a weathered, rusted corrugated shipping container in an industrial dockyard at golden hour. The paint must flow into the corrugated ridges and valleys of the steel — pigment pools in the troughs and stretches across the ribs. Slight flaking and rust patches show through the paint at ~5% opacity. Camera angle 35° to the right of the wall, eye level, 35mm lens, photorealistic, no text, no watermarks, no UI.",
    retryPrompt:
      "Same industrial shipping container scene, but recompose: camera angle 50° to the left, lower elevation 15°, late-afternoon warm key light from camera-right, longer cast shadows from the container ridges, slightly more pigment pooling in the corrugation troughs. Photorealistic, no text.",
  },
  {
    id: "corner",
    name: "Dual-Plane Brick Corner",
    basePrompt:
      "Place the provided artwork as a hand-painted mural that wraps across a 90° outdoor corner of a weathered red brick building. The composition continues seamlessly across both wall planes with correct vanishing-point perspective and warp at the seam. Mortar lines and brick texture break through the paint at ~5% opacity. Soft overcast daylight, camera positioned 3 meters from the corner showing both faces equally, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same dual-plane brick corner mural, but recompose: drop camera elevation to street level, rotate viewpoint 25° clockwise so the right plane recedes more sharply, switch to warm late-day directional light from camera-left casting hard shadows along the mortar lines. Photorealistic, no text.",
  },
  {
    id: "concrete",
    name: "Obstructed Concrete Facade",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on a large weathered concrete facade in an urban back-alley. A wooden utility pole with hanging black power lines crosses in front of the mural, casting sharp diagonal shadows directly onto the painted surface. Concrete texture, stains and small cracks read through the paint at ~5% opacity. Midday sun, camera angle straight-on with slight 10° tilt, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same obstructed concrete facade mural, but recompose: shift camera 40° to the right so the utility pole's shadow falls across the lower-left of the mural, raise sun angle to early morning casting long cool-blue shadows, increase concrete weathering and water staining. Photorealistic, no text.",
  },
];

const STYLE_LOCK =
  "CRITICAL: The mural artwork must match the reference image 1:1 — preserve the exact composition, line work, color palette, and every detail. Do not stylize, simplify, or redraw the artwork. Render it as if a skilled muralist hand-painted an exact reproduction of the reference onto the wall, with the wall's surface texture subtly bleeding through the paint at roughly 5% opacity.";

async function generateOne(
  scene: Scene,
  artworkDataUrl: string,
  variant: "base" | "retry",
): Promise<{ id: Scene["id"]; name: string; imageUrl: string | null; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { id: scene.id, name: scene.name, imageUrl: null, error: "LOVABLE_API_KEY not configured" };
  }

  const prompt = `${STYLE_LOCK}\n\nSCENE: ${variant === "base" ? scene.basePrompt : scene.retryPrompt}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: artworkDataUrl } },
            ],
          },
        ],
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
  .inputValidator((input: { artworkDataUrl: string; variant?: "base" | "retry" }) => {
    if (!input?.artworkDataUrl || typeof input.artworkDataUrl !== "string") {
      throw new Error("artworkDataUrl required");
    }
    if (!input.artworkDataUrl.startsWith("data:image/")) {
      throw new Error("artworkDataUrl must be a data:image/* URL");
    }
    return { artworkDataUrl: input.artworkDataUrl, variant: input.variant ?? "base" };
  })
  .handler(async ({ data }) => {
    const results = await Promise.all(
      SCENES.map((s) => generateOne(s, data.artworkDataUrl, data.variant)),
    );
    return { murals: results };
  });
