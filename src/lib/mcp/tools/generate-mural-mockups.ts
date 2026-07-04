import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "generate_mural_mockups",
  title: "Generate mural mockups",
  description:
    "Render 3 photorealistic mural mockups (frontal shipping container, angled brick corner, obstructed concrete facade) from an artwork image URL. Optionally composite the mural onto a provided wall photo.",
  inputSchema: {
    artworkUrl: z
      .string()
      .url()
      .describe("Public HTTPS URL of the artwork image to paint as a mural."),
    wallUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional public HTTPS URL of a wall photo to use as the background plate."),
    variant: z
      .enum(["base", "retry"])
      .default("base")
      .describe("'base' for default composition, 'retry' to recompose lighting/angle."),
    count: z
      .number()
      .int()
      .min(1)
      .max(3)
      .default(3)
      .describe("Number of mockup scenes to render (1-3)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ artworkUrl, wallUrl, variant }) => {
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

    const [artworkDataUrl, wallDataUrl] = await Promise.all([
      toDataUrl(artworkUrl),
      wallUrl ? toDataUrl(wallUrl) : Promise.resolve(null),
    ]);

    const { generateMurals } = await import("@/lib/mural.functions");
    const result = await generateMurals({
      data: { artworkDataUrl, wallDataUrl, variant, apiKey: null },
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
