import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "generate_mural_mockups",
  title: "Generate mural mockups",
  description:
    "Render photorealistic mural mockups: one per artwork (separate), all artworks in one mural (combined), or one artwork on 1-3 wall photos (multiwall).",
  inputSchema: {
    artworkUrls: z
      .array(z.string().url())
      .min(1)
      .max(3)
      .describe("1-3 public HTTPS URLs of artwork images. One mockup is rendered per artwork."),
    wallUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional public HTTPS URL of a wall photo to use as the background plate for every mockup.",
      ),
    wallUrls: z
      .array(z.string().url())
      .min(1)
      .max(3)
      .optional()
      .describe("1-3 public HTTPS URLs of wall photos for 'multiwall' mode. One mockup per wall."),
    variant: z
      .enum(["base", "retry"])
      .default("base")
      .describe("'base' for default composition, 'retry' to recompose lighting/angle."),
    mode: z
      .enum(["separate", "combined", "multiwall"])
      .default("separate")
      .describe(
        "'separate' renders one mural per artwork; 'combined' incorporates all artworks into a single mural; 'multiwall' paints the first artwork on each wall in wallUrls.",
      ),
    count: z
      .number()
      .int()
      .min(1)
      .max(3)
      .default(1)
      .describe("Number of mockups to render in 'combined' mode (ignored in 'separate' mode)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ artworkUrls, wallUrl, wallUrls, variant, mode, count }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: "text", text: "LOVABLE_API_KEY is not configured on the server." }],
        isError: true,
      };
    }

    async function toDataUrl(url: string): Promise<string> {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
      const ct = r.headers.get("content-type") ?? "image/png";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return `data:${ct};base64,${btoa(bin)}`;
    }

    if (mode === "multiwall" && !wallUrls?.length && !wallUrl) {
      return {
        content: [{ type: "text", text: "multiwall mode needs at least one wall photo URL." }],
        isError: true,
      };
    }
    let artworkDataUrls: string[];
    let wallDataUrl: string | null;
    let wallDataUrls: string[] | null;
    try {
      [artworkDataUrls, wallDataUrl, wallDataUrls] = await Promise.all([
        Promise.all(artworkUrls.map(toDataUrl)),
        wallUrl ? toDataUrl(wallUrl) : Promise.resolve(null),
        mode === "multiwall" && wallUrls?.length
          ? Promise.all(wallUrls.map(toDataUrl))
          : Promise.resolve(null),
      ]);
    } catch (err) {
      return {
        content: [
          { type: "text", text: err instanceof Error ? err.message : "Could not fetch an image." },
        ],
        isError: true,
      };
    }

    const { generateMurals } = await import("@/lib/mural.functions");
    const result = await generateMurals({
      data: { artworkDataUrls, wallDataUrl, wallDataUrls, variant, mode, count, apiKey: null },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            result.murals.map((m) => ({
              id: m.id,
              name: m.name,
              imageUrl: m.imageUrl,
              error: m.error,
            })),
          ),
        },
      ],
      structuredContent: { murals: result.murals },
    };
  },
});
