import { defineMcp } from "@lovable.dev/mcp-js";
import generateMuralMockups from "./tools/generate-mural-mockups";

export default defineMcp({
  name: "mural-studio-mcp",
  title: "Mural Studio MCP",
  version: "0.1.0",
  instructions:
    "Tools for Mural Mockup Studio. Use `generate_mural_mockups` to render 3 photorealistic mural mockups from an artwork image URL, optionally composited onto a provided wall photo.",
  tools: [generateMuralMockups],
});
