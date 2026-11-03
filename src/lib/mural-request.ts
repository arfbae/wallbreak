// Browser-safe validation for a mural render request. Every message thrown here
// is written to be shown to the user verbatim.

export type MuralMode = "separate" | "combined" | "multiwall";

export type RawMuralRequest = {
  artworkDataUrl?: string;
  artworkDataUrls?: string[];
  wallDataUrl?: string | null;
  wallDataUrls?: (string | null)[] | null;
  variant?: "base" | "retry";
  apiKey?: string | null;
  apiKeys?: string[] | null;
  serverFallback?: boolean;
  mode?: MuralMode;
  count?: number;
  keepBackground?: boolean;
  compositionPlan?: string | null;
};

export type MuralRequest = {
  artworks: string[];
  /** Separate/combined: 0 or 1 wall. Multi-wall: 1–3 walls, one mockup each. */
  walls: string[];
  variant: "base" | "retry";
  apiKeys: string[];
  serverFallback: boolean;
  mode: MuralMode;
  count: number;
  keepBackground: boolean;
  compositionPlan: string | null;
};

export const MAX_ARTWORKS = 3;
export const MAX_WALLS = 3;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const isImageDataUrl = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith("data:image/") && v.includes(",");

export const dataUrlBytes = (d: string) => Math.floor(((d.length - d.indexOf(",") - 1) * 3) / 4);

export function normalizeMuralRequest(input: RawMuralRequest | null | undefined): MuralRequest {
  if (!input || typeof input !== "object") throw new Error("The render request was empty.");

  const mode: MuralMode =
    input.mode === "combined" ? "combined" : input.mode === "multiwall" ? "multiwall" : "separate";

  const rawArtworks: unknown[] = [];
  if (Array.isArray(input.artworkDataUrls)) rawArtworks.push(...input.artworkDataUrls);
  if (input.artworkDataUrl != null) rawArtworks.push(input.artworkDataUrl);
  if (rawArtworks.some((a) => a != null && !isImageDataUrl(a))) {
    throw new Error("One of your artworks isn't a supported image. Use PNG, JPG or WEBP.");
  }
  let artworks = rawArtworks.filter(isImageDataUrl).slice(0, MAX_ARTWORKS);
  if (artworks.length === 0) throw new Error("Add an artwork before rendering.");
  // One artwork on several walls: only the first artwork is painted.
  if (mode === "multiwall") artworks = artworks.slice(0, 1);

  const rawWalls: unknown[] = [];
  if (mode === "multiwall" && Array.isArray(input.wallDataUrls)) {
    rawWalls.push(...input.wallDataUrls.filter((w) => w != null));
  }
  if (rawWalls.length === 0 && input.wallDataUrl != null) rawWalls.push(input.wallDataUrl);
  if (rawWalls.some((w) => !isImageDataUrl(w))) {
    throw new Error("One of your wall photos isn't a supported image. Use PNG, JPG or WEBP.");
  }
  let walls = (rawWalls as string[]).slice(0, mode === "multiwall" ? MAX_WALLS : 1);
  if (mode === "multiwall" && walls.length === 0) {
    throw new Error("Add at least one wall photo to put your artwork on several walls.");
  }
  if (mode !== "multiwall") walls = walls.slice(0, 1);

  let total = 0;
  for (const img of [...artworks, ...walls]) {
    const size = dataUrlBytes(img);
    total += size;
    if (size > MAX_IMAGE_BYTES) {
      throw new Error("One of your images is too large. Please use an image under 8 MB.");
    }
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new Error("Your images are too large in total. Remove one or use smaller files.");
  }

  const rawKeys: unknown[] = [];
  if (Array.isArray(input.apiKeys)) rawKeys.push(...input.apiKeys);
  if (input.apiKey != null) rawKeys.push(input.apiKey);
  const apiKeys = Array.from(
    new Set(rawKeys.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)),
  );

  const n = Number(input.count);
  const count = Number.isFinite(n) ? Math.min(3, Math.max(1, Math.round(n))) : 1;

  return {
    artworks,
    walls,
    variant: input.variant === "retry" ? "retry" : "base",
    apiKeys,
    serverFallback: input.serverFallback !== false,
    mode,
    count,
    keepBackground: input.keepBackground === true,
    compositionPlan:
      mode === "combined" &&
      typeof input.compositionPlan === "string" &&
      input.compositionPlan.trim()
        ? input.compositionPlan.trim().slice(0, 3000)
        : null,
  };
}

/** How many mockups a request will produce (used for button copy and placeholders). */
export function expectedMockupCount(
  mode: MuralMode,
  artworkCount: number,
  wallCount: number,
  count: number,
): number {
  if (mode === "combined") return Math.min(3, Math.max(1, count));
  if (mode === "multiwall") return Math.min(MAX_WALLS, wallCount);
  return Math.min(MAX_ARTWORKS, artworkCount);
}
