import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "generate_mural_mockups",
  title: "Generate mural mockups",
  description:
    "Render one photorealistic mural mockup per artwork (up to 3). Optionally composite each mural onto a provided wall photo.",
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
      .describe("Optional public HTTPS URL of a wall photo to use as the background plate for every mockup."),
    variant: z
      .enum(["base", "retry"])
      .default("base")
      .describe("'base' for default composition, 'retry' to recompose lighting/angle."),
    mode: z
      .enum(["separate", "combined"])
      .default("separate")
      .describe(
        "'separate' renders one mural per artwork; 'combined' incorporates all artworks into a single mural.",
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
  handler: async ({ artworkUrls, wallUrl, variant, mode, count }) => {

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

    const [artworkDataUrls, wallDataUrl] = await Promise.all([
      Promise.all(artworkUrls.map(toDataUrl)),
      wallUrl ? toDataUrl(wallUrl) : Promise.resolve(null),
    ]);

    const { generateMurals } = await import("@/lib/mural.functions");
    const result = await generateMurals({
      data: { artworkDataUrls, wallDataUrl, variant, apiKey: null },
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
