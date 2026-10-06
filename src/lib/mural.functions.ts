import { createServerFn } from "@tanstack/react-start";
import { assertPromptIntegrity, buildMuralPrompt } from "./mural-prompt";
import { buildResourcePlan, renderImageWithFailover } from "./generation-router";
import { classifyRenderedMedium } from "./mural-classifier";
import { hashPrompt, logRender, newCorrelationId } from "./render-log";
import { analyzeArtworkSource, buildIsolationRule } from "./artwork-analysis";

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
      "Place the provided artwork as a hand-painted mural on the side of a weathered, rusted corrugated shipping container in an industrial dockyard at golden hour. The paint must flow into the corrugated ridges and valleys of the steel — pigment pools in the troughs and stretches across the ribs. Slight flaking and rust patches show only as relief and grain beneath fully opaque paint. Camera angle 35° to the right of the wall, eye level, 35mm lens, photorealistic, no text, no watermarks, no UI.",
    retryPrompt:
      "Same industrial shipping container scene, but recompose: camera angle 50° to the left, lower elevation 15°, late-afternoon warm key light from camera-right, longer cast shadows from the container ridges. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo, pixel-for-pixel, with ONLY the painted mural added on top of its primary wall surface. Do NOT redraw, restyle, recolor, relight, re-crop, or replace the wall, sky, ground, surroundings, or any other element of the photo. Identify the largest flat paintable wall plane in the photo and place the first image as a hand-painted mural confined to that plane, conforming to its perspective, vanishing points, and surface curvature. The wall's real texture, mortar lines, panel seams, cracks, stains, dirt, and existing surface lighting MUST show only as physical relief and grain beneath FULLY OPAQUE paint (never as transparency). Light the painted area using the EXACT same direction, hardness, and color temperature already present in the photo — match existing highlights and shadows on adjacent surfaces. Add subtle, physically correct shading where real foreground objects (poles, signs, vegetation, wires) occlude the mural; never erase those objects. Framing must remain identical to the source photo. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural locked to the same wall plane — but subtly recompose lighting only: shift the painted-area highlights to suggest warmer late-afternoon raking light from the same direction already in the photo, deepen existing shadows slightly. Do NOT change camera, crop, wall, surroundings, or replace the photo. Keep the paint fully opaque with only surface relief showing. Photorealistic, no text.",
  },
  {
    id: "corner",
    name: "Scene B — Angled",
    basePrompt:
      "Place the provided artwork as a hand-painted mural that wraps across a 90° outdoor corner of a weathered red brick building. The composition continues seamlessly across both wall planes with correct vanishing-point perspective and warp at the seam. Mortar lines and brick texture show only as relief and grain beneath fully opaque paint. Soft overcast daylight, camera positioned 3 meters from the corner showing both faces equally, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same dual-plane brick corner mural, but recompose: drop camera elevation to street level, rotate viewpoint 25° clockwise, warm late-day directional light from camera-left casting hard shadows. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo unchanged except for one addition: render the first image as a hand-painted mural on the primary wall plane, but framed/cropped tighter so the mural occupies more of the frame at an oblique reading angle (the mural itself appears foreshortened along the wall's existing perspective lines). Do NOT replace the wall, sky, ground, or surroundings. Mortar lines, panel seams, surface cracks, stains, and dirt from the real wall MUST show only as physical relief and grain beneath FULLY OPAQUE paint (never as transparency). Light the painted area using the SAME direction, hardness, and color temperature already in the photo. Respect any real foreground occluders. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural on the same wall plane — recompose only the painted area's lighting: warmer directional light from the same source already in the photo, harder shadows along existing wall texture. Do NOT alter the photo, camera, crop, or surroundings. Keep the paint fully opaque with only surface relief showing. Photorealistic, no text.",
  },
  {
    id: "concrete",
    name: "Scene C — Obstructed",
    basePrompt:
      "Place the provided artwork as a hand-painted mural on a large weathered concrete facade in an urban back-alley. A wooden utility pole with hanging black power lines crosses in front of the mural, casting sharp diagonal shadows directly onto the painted surface. Concrete texture, stains and small cracks show only as relief and grain beneath fully opaque paint. Midday sun, camera angle straight-on with slight 10° tilt, photorealistic, no text, no watermarks.",
    retryPrompt:
      "Same obstructed concrete facade mural, but recompose: shift camera 40° to the right, raise sun angle to early morning casting long cool-blue shadows, increase concrete weathering and water staining. Photorealistic, no text.",
    wallBasePrompt:
      "STRICT BACKGROUND LOCK: Use the SECOND image as the literal photographic background. Return that exact photo unchanged except: render the first image as a hand-painted mural on the primary wall plane AND any real foreground objects already present in the photo (utility poles, wires, signage, branches, parked cars, pedestrians, fences) must remain visibly in front of the mural with physically correct occlusion and shadows falling onto the paint. If no foreground occluder exists in the source photo, add a single thin diagonal shadow consistent with the photo's existing light direction. Do NOT replace the wall, sky, or surroundings. Real surface texture (concrete pores, cracks, water stains) MUST show only as physical relief and grain beneath FULLY OPAQUE paint (never as transparency). Match the photo's existing lighting and color temperature exactly. Photorealistic composite, no text, no watermarks, no UI.",
    wallRetryPrompt:
      "Same source wall photo, same mural and same real foreground objects — recompose only the painted area's lighting: cooler early-morning quality with longer shadows from the same light direction already in the photo. Do NOT alter the photo, camera, crop, or surroundings. Keep the paint fully opaque with only surface relief showing. Photorealistic, no text.",
  },
];

type KeyEntry = { key: string; label: string };

type RenderCtx = {
  cid: string;
  scene: string;
  variant: string;
  artworks: number;
  promptHash: string;
};

async function generateOne(
  scene: Scene,
  artworkDataUrls: string[],
  wallDataUrl: string | null,
  variant: "base" | "retry",
  keys: KeyEntry[],
  extraPrompt?: string,
  layoutIndex = 0,
  isolationRule?: string,
): Promise<{
  id: Scene["id"];
  name: string;
  imageUrl: string | null;
  error?: string;
  keyUsed?: string;
}> {
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
  const prompt = buildMuralPrompt({
    scenePrompt,
    artworkCount: n,
    hasWall: Boolean(wallDataUrl),
    extraPrompt,
    layoutIndex,
    isolationRule,
  });
  assertPromptIntegrity(prompt, `scene=${scene.id} variant=${variant} artworks=${n}`, n);

  const ctx: RenderCtx = {
    cid: newCorrelationId(),
    scene: scene.id,
    variant,
    artworks: n,
    promptHash: hashPrompt(prompt),
  };
  logRender({ ...ctx, event: "render-start", promptChars: prompt.length });

  // The complete mural request (prompt + artwork + wall) goes to the central
  // router, which owns model/credential selection, cooldowns and failover.
  const outcome = await renderImageWithFailover(
    { prompt, artworkDataUrls, wallDataUrl },
    buildResourcePlan(keys),
    {
      onAttempt: (a) =>
        logRender(
          {
            ...ctx,
            event: a.ok ? "router-attempt-ok" : "router-attempt-failed",
            key: a.credential,
            detail: `${a.model} try=${a.attempt}${a.failure ? ` failure=${a.failure}` : ""}`,
            ms: a.ms,
          },
          a.ok ? "info" : "warn",
        ),
    },
  );

  if (!outcome.ok) {
    logRender(
      { ...ctx, event: "render-failed", detail: `${outcome.failure} attempts=${outcome.attempts.length}` },
      "error",
    );
    return { id: scene.id, name: scene.name, imageUrl: null, error: outcome.message };
  }

  const verdict = await classifyRenderedMedium(outcome.imageUrl, outcome.resource.credential.key);
  logRender(
    {
      ...ctx,
      event: "medium-classifier",
      key: outcome.resource.credential.label,
      medium: verdict ? (verdict.ok ? "ok" : "wrong") : "unknown",
      offenders: verdict?.issues ?? [],
      detail: verdict ? `${verdict.medium} conf=${verdict.confidence}` : "classifier unavailable",
    },
    verdict && !verdict.ok ? "warn" : "info",
  );
  logRender({
    ...ctx,
    event: "render-ok",
    key: outcome.resource.credential.label,
    detail: outcome.resource.model,
  });
  return {
    id: scene.id,
    name: scene.name,
    imageUrl: outcome.imageUrl,
    keyUsed: outcome.resource.credential.label,
  };
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
      keepBackground?: boolean;
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
      // Payload guard: keep each image (and the whole request) within a size the
      // gateway can accept, with a message the UI can show verbatim.
      const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
      const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
      const bytesOf = (d: string) => Math.floor(((d.length - d.indexOf(",") - 1) * 3) / 4);
      let total = 0;
      for (const img of [...artworks, ...(input.wallDataUrl ? [input.wallDataUrl] : [])]) {
        const size = bytesOf(img);
        total += size;
        if (size > MAX_IMAGE_BYTES) {
          throw new Error("One of your images is too large. Please use an image under 8 MB.");
        }
      }
      if (total > MAX_TOTAL_BYTES) {
        throw new Error("Your images are too large in total. Remove one or use smaller files.");
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
        keepBackground: input.keepBackground === true,
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
      const { resolveCaller, checkServerKeyQuota, SERVER_KEY_DAILY_LIMIT } =
        await import("./gen-guard.server");
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

    // Pre-render pass: work out what part of every upload is actually the
    // artwork (photos of canvases, screenshots with UI chrome, artwork inside a
    // wider scene) so the renderer paints the subject and not its surroundings.
    const analysisKey = keys[0]?.key;
    const analyses = analysisKey
      ? await Promise.all(
          data.artworks.map(async (a, i) => {
            const result = await analyzeArtworkSource(a, analysisKey);
            logRender(
              {
                cid: `iso_${i}`,
                event: "artwork-isolation",
                detail: result
                  ? `${result.kind} subject="${result.subject}" bg=${result.removeBackground} conf=${result.confidence}`
                  : "analyser unavailable",
              },
              result ? "info" : "warn",
            );
            return result;
          }),
        )
      : [];
    const isolationRule = buildIsolationRule(analyses, data.keepBackground);

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
            isolationRule,
          ).then((r) => ({
            ...r,
            index: i,
            name: data.count > 1 ? `Mockup ${i + 1}` : "Combined Mural",
          }));
        }),
      );
      return { murals: await meter(results) };
    }

    const results = await Promise.all(
      data.artworks.map((artworkDataUrl, i) => {
        // When a wall photo is provided, every mockup uses Scene A's strict
        // background-lock prompt (Scene B/C rewrite/obstruct the photo).
        const baseScene = data.wallDataUrl ? SCENES[0] : SCENES[i % SCENES.length];
        const sceneWithId: Scene = { ...baseScene, id: `${baseScene.id}-${i}` as Scene["id"] };
        return generateOne(
          sceneWithId,
          [artworkDataUrl],
          data.wallDataUrl,
          data.variant,
          keys,
          undefined,
          0,
          isolationRule,
        ).then((r) => ({
          ...r,
          index: i,
          name: `Artwork ${i + 1}`,
        }));
      }),
    );
    return { murals: await meter(results) };
  });
