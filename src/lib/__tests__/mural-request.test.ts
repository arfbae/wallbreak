import { describe, expect, it } from "vitest";
import { expectedMockupCount, normalizeMuralRequest } from "../mural-request";

const img = (tag: string) => `data:image/png;base64,${btoa(tag)}`;

describe("one artwork on several walls", () => {
  it("renders one mockup per wall, up to three walls", () => {
    const r = normalizeMuralRequest({
      mode: "multiwall",
      artworkDataUrls: [img("a")],
      wallDataUrls: [img("w1"), img("w2"), img("w3"), img("w4")],
    });
    expect(r.walls).toHaveLength(3);
    expect(expectedMockupCount("multiwall", 1, 2, 1)).toBe(2);
  });

  it("paints only the first artwork", () => {
    const r = normalizeMuralRequest({
      mode: "multiwall",
      artworkDataUrls: [img("a1"), img("a2")],
      wallDataUrls: [img("w1")],
    });
    expect(r.artworks).toEqual([img("a1")]);
  });

  it("refuses to render without a wall photo", () => {
    expect(() =>
      normalizeMuralRequest({ mode: "multiwall", artworkDataUrls: [img("a")], wallDataUrls: [] }),
    ).toThrow("Add at least one wall photo");
  });

  it("skips empty wall boxes", () => {
    const r = normalizeMuralRequest({
      mode: "multiwall",
      artworkDataUrls: [img("a")],
      wallDataUrls: [null, img("w2"), null],
    });
    expect(r.walls).toEqual([img("w2")]);
  });

  it("rejects a wall that isn't an image", () => {
    expect(() =>
      normalizeMuralRequest({
        mode: "multiwall",
        artworkDataUrls: [img("a")],
        wallDataUrls: ["https://example.com/wall.jpg"],
      }),
    ).toThrow("isn't a supported image");
  });
});

describe("existing modes keep a single wall", () => {
  it("separate mode ignores extra wall boxes", () => {
    const r = normalizeMuralRequest({
      mode: "separate",
      artworkDataUrls: [img("a")],
      wallDataUrl: img("w1"),
      wallDataUrls: [img("w2")],
    });
    expect(r.walls).toEqual([img("w1")]);
  });

  it("requires an artwork", () => {
    expect(() => normalizeMuralRequest({ artworkDataUrls: [] })).toThrow("Add an artwork");
  });

  it("rejects a single image over 8 MB", () => {
    const big = `data:image/png;base64,${"A".repeat(Math.ceil((9 * 1024 * 1024 * 4) / 3))}`;
    expect(() => normalizeMuralRequest({ artworkDataUrls: [big] })).toThrow("under 8 MB");
  });

  it("rejects images over 20 MB in total", () => {
    const seven = `data:image/png;base64,${"A".repeat(Math.ceil((7 * 1024 * 1024 * 4) / 3))}`;
    expect(() =>
      normalizeMuralRequest({
        mode: "multiwall",
        artworkDataUrls: [seven],
        wallDataUrls: [seven, seven],
      }),
    ).toThrow("too large in total");
  });
});
