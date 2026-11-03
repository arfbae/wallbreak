import { createServerFn } from "@tanstack/react-start";
import { assertPromptIntegrity, buildMuralPrompt } from "./mural-prompt";
import { buildResourcePlan, renderImageWithFailover } from "./generation-router";
import { classifyRenderedMedium } from "./mural-classifier";
import { hashPrompt, logRender, newCorrelationId } from "./render-log";
import {
  analyzeArtworkSource,
  buildIsolationRule,
  needsGeneratedBackdrop,
} from "./artwork-analysis";
import { normalizeMuralRequest, type RawMuralRequest } from "./mural-request";
import { letteringSignal, type LetteringSignal } from "./graffiti-style";
import {
  analyzeWallGeometry,
  buildProjectionRule,
  dataUrlAspect,
  verifyPlacement,
  type WallGeometry,
} from "./wall-geometry";

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
  projection?: { rule: string; geometry: WallGeometry | null },
  attempt = 0,
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
    extraPrompt: [extraPrompt, projection?.rule].filter(Boolean).join("\n\n") || undefined,
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
      {
        ...ctx,
        event: "render-failed",
        detail: `${outcome.failure} attempts=${outcome.attempts.length}`,
      },
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
  // Projection check: a render with paint off the wall plane is re-rendered
  // once with the measured bounds and the reported faults spelled out.
  if (wallDataUrl && projection) {
    const placement = await verifyPlacement(
      outcome.imageUrl,
      projection.geometry,
      outcome.resource.credential.key,
    );
    logRender(
      {
        ...ctx,
        event: "placement-check",
        detail: placement
          ? `${placement.ok ? "on-wall" : "OFF-WALL"} ${placement.issues.join("; ")}`
          : "verifier unavailable",
      },
      placement && !placement.ok ? "warn" : "info",
    );
    if (placement && !placement.ok && attempt === 0) {
      const fix = `PLACEMENT CORRECTION (previous attempt was rejected): ${placement.issues.join("; ") || "paint left the wall plane"}. Keep every painted pixel strictly inside the measured wall bounds.`;
      return generateOne(
        scene,
        artworkDataUrls,
        wallDataUrl,
        variant,
        keys,
        [extraPrompt, fix].filter(Boolean).join("\n\n"),
        layoutIndex,
        isolationRule,
        projection,
        1,
      );
    }
  }
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

/** One render must never take down its siblings: any unexpected throw becomes a failed panel. */
async function safeGenerate(
  label: string,
  sceneId: string,
  run: () => ReturnType<typeof generateOne>,
): ReturnType<typeof generateOne> {
  try {
    return await run();
  } catch (err) {
    logRender(
      {
        cid: `safe_${sceneId}`,
        event: "render-exception",
        detail: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
      },
      "error",
    );
    return {
      id: sceneId as Scene["id"],
      name: label,
      imageUrl: null,
      error: "This mockup couldn't be made. Press Recompose to try again.",
    };
  }
}

export const generateMurals = createServerFn({ method: "POST" })
  .inputValidator((input: RawMuralRequest) => normalizeMuralRequest(input))
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
      if (used === 0) return results;
      try {
        const { recordServerKeyUsage } = await import("./gen-guard.server");
        await recordServerKeyUsage(quotaUserId, used);
      } catch (err) {
        // Finished mockups are never thrown away because usage logging failed.
        logRender(
          {
            cid: "meter",
            event: "meter-failed",
            detail: err instanceof Error ? err.message.slice(0, 200) : "unknown",
          },
          "error",
        );
      }
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
            const result = await analyzeArtworkSource(a, analysisKey).catch(() => null);
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
    const signals = analyses.map((a, i) => letteringSignal(a?.graffiti, i));
    const letteringFor = (idx: number[]): LetteringSignal[] =>
      idx.map((i) => signals[i]).filter((s): s is LetteringSignal => !!s);
    const backdropFor = (idx: number[]) => idx.some((i) => needsGeneratedBackdrop(analyses[i]));

    // Projection mapping: measure each wall's paintable quad, then give every
    // render explicit target coordinates instead of "paint on the wall".
    const measureWall = async (wallUrl: string, idx: number): Promise<WallGeometry | null> => {
      if (!analysisKey) return null;
      const g = await analyzeWallGeometry(wallUrl, analysisKey).catch(() => null);
      logRender(
        {
          cid: `wall_${idx}`,
          event: "wall-geometry",
          detail: g
            ? `${g.surface} conf=${g.confidence} occluders=${g.occluders.length}`
            : "unavailable",
        },
        g ? "info" : "warn",
      );
      return g;
    };
    const projectionOn = (wallUrl: string, geometry: WallGeometry | null, arts: string[]) => ({
      geometry,
      rule: buildProjectionRule(
        geometry,
        arts.length === 1 ? (dataUrlAspect(arts[0]!) ?? 1) : 1.618,
        dataUrlAspect(wallUrl) ?? 4 / 3,
      ),
    });

    // One artwork on several walls: every wall is measured and rendered on its
    // own, so one bad wall photo never costs the others their mockup.
    if (data.mode === "multiwall") {
      const artwork = data.artworks[0]!;
      const rule = buildIsolationRule([analyses[0] ?? null], data.keepBackground);
      const results = await Promise.all(
        data.walls.map(async (wallUrl, i) => {
          const name = `Wall ${i + 1}`;
          const sceneWithId: Scene = { ...SCENES[0], id: `container-w${i}` as Scene["id"] };
          const r = await safeGenerate(name, sceneWithId.id, async () =>
            generateOne(
              sceneWithId,
              [artwork],
              wallUrl,
              data.variant,
              keys,
              undefined,
              0,
              rule,
              projectionOn(wallUrl, await measureWall(wallUrl, i), [artwork]),
            ),
          );
          return {
            ...r,
            index: i,
            wallIndex: i,
            name,
            lettering: letteringFor([0]),
            backdropAdded: backdropFor([0]),
          };
        }),
      );
      return { murals: await meter(results) };
    }

    const wallDataUrl = data.walls[0] ?? null;
    const geometry = wallDataUrl ? await measureWall(wallDataUrl, 0) : null;
    const projectionFor = (arts: string[]) =>
      wallDataUrl ? projectionOn(wallDataUrl, geometry, arts) : undefined;

    if (data.mode === "combined") {
      const results = await Promise.all(
        Array.from({ length: data.count }, (_, i) => {
          const baseScene = wallDataUrl ? SCENES[0] : SCENES[i % SCENES.length];
          const sceneWithId: Scene = { ...baseScene, id: `${baseScene.id}-${i}` as Scene["id"] };
          const name = data.count > 1 ? `Mockup ${i + 1}` : "Combined Mural";
          return safeGenerate(name, sceneWithId.id, () =>
            generateOne(
              sceneWithId,
              data.artworks,
              wallDataUrl,
              data.variant,
              keys,
              [data.artworks.length > 1 ? data.compositionPlan : null, VARIATIONS[i]]
                .filter(Boolean)
                .join("\n\n"),
              i,
              isolationRule,
              projectionFor(data.artworks),
            ),
          ).then((r) => ({
            ...r,
            index: i,
            wallIndex: 0,
            name,
            lettering: letteringFor(data.artworks.map((_, k) => k)),
            backdropAdded: backdropFor(data.artworks.map((_, k) => k)),
          }));
        }),
      );
      return { murals: await meter(results) };
    }

    const results = await Promise.all(
      data.artworks.map((artworkDataUrl, i) => {
        // When a wall photo is provided, every mockup uses Scene A's strict
        // background-lock prompt (Scene B/C rewrite/obstruct the photo).
        const baseScene = wallDataUrl ? SCENES[0] : SCENES[i % SCENES.length];
        const sceneWithId: Scene = { ...baseScene, id: `${baseScene.id}-${i}` as Scene["id"] };
        const name = `Artwork ${i + 1}`;
        return safeGenerate(name, sceneWithId.id, () =>
          generateOne(
            sceneWithId,
            [artworkDataUrl],
            wallDataUrl,
            data.variant,
            keys,
            undefined,
            0,
            // One artwork per render: give it its own isolation rule so the
            // "Artwork 1" references (backdrop, graffiti) describe this upload.
            buildIsolationRule([analyses[i] ?? null], data.keepBackground),
            projectionFor([artworkDataUrl]),
          ),
        ).then((r) => ({
          ...r,
          index: i,
          wallIndex: 0,
          name,
          lettering: letteringFor([i]),
          backdropAdded: backdropFor([i]),
        }));
      }),
    );
    return { murals: await meter(results) };
  });
