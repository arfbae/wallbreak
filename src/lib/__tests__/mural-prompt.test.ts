import { describe, expect, it, vi } from "vitest";
import {
  assertPromptIntegrity,
  buildMuralPrompt,
  checkResponseMedium,
  findMissingPromptMarkers,
  MEDIUM_TRANSLATION,
  REQUIRED_PROMPT_MARKERS,
} from "../mural-prompt";

const scene = "Place the artwork on a weathered concrete facade. Photorealistic, no text.";

const build = (over: Partial<Parameters<typeof buildMuralPrompt>[0]> = {}) =>
  buildMuralPrompt({ scenePrompt: scene, artworkCount: 1, hasWall: false, ...over });

describe("assembled prompt always carries MEDIUM_TRANSLATION", () => {
  const cases = [
    { name: "single artwork, no wall", input: { artworkCount: 1, hasWall: false } },
    { name: "single artwork, wall photo", input: { artworkCount: 1, hasWall: true } },
    { name: "two artworks combined", input: { artworkCount: 2, hasWall: true, layoutIndex: 1 } },
    { name: "three artworks combined", input: { artworkCount: 3, hasWall: true, layoutIndex: 2 } },
    {
      name: "with a composition variation",
      input: { artworkCount: 3, hasWall: true, extraPrompt: "COMPOSITION VARIATION 2: ..." },
    },
  ];

  for (const c of cases) {
    it(`includes the full medium rule — ${c.name}`, () => {
      const prompt = build(c.input);
      expect(prompt).toContain(MEDIUM_TRANSLATION);
      expect(findMissingPromptMarkers(prompt)).toEqual([]);
    });
  }

  it("includes every mandatory rule marker", () => {
    const prompt = build();
    for (const marker of REQUIRED_PROMPT_MARKERS) {
      expect(prompt, `missing ${marker.id}`).toContain(marker.needle);
    }
  });

  it("orders anti-ghost before medium translation before style lock", () => {
    const p = build();
    expect(p.indexOf("ANTI-GHOST RULE")).toBeLessThan(p.indexOf("MEDIUM TRANSLATION (mandatory)"));
    expect(p.indexOf("MEDIUM TRANSLATION (mandatory)")).toBeLessThan(
      p.indexOf("CRITICAL ARTWORK FIDELITY"),
    );
  });

  it("forbids the printed/pasted-picture medium in the self-check", () => {
    const p = build();
    expect(p).toContain("NO paper grain/canvas weave/frame/border/white margin/rectangular edge");
  });
});

describe("prompt integrity guard", () => {
  it("passes a healthy prompt and logs OK", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => assertPromptIntegrity(build(), "test")).not.toThrow();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("[mural:prompt-guard] OK"));
    info.mockRestore();
  });

  it("throws and logs when MEDIUM_TRANSLATION is stripped out", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = build().replace(MEDIUM_TRANSLATION, "");
    expect(findMissingPromptMarkers(broken)).toContain("MEDIUM_TRANSLATION");
    expect(() => assertPromptIntegrity(broken, "test")).toThrow(/MEDIUM_TRANSLATION/);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("[mural:prompt-guard] FAIL"));
    err.mockRestore();
  });

  it("throws when any other mandatory rule goes missing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = build().replace("ANTI-GHOST RULE", "SOFT SUGGESTION");
    expect(() => assertPromptIntegrity(broken, "test")).toThrow(/ANTI_GHOST/);
    vi.restoreAllMocks();
  });
});

describe("renderer medium/style response check", () => {
  it("accepts a correct mural description", () => {
    const r = checkResponseMedium(
      "Painted directly on the wall with aerosol gradients and roller texture, matte finish, no canvas weave.",
    );
    expect(r.ok).toBe(true);
    expect(r.offenders).toEqual([]);
  });

  it("flags a pasted-picture / wrong-medium description", () => {
    const r = checkResponseMedium("The artwork is displayed as a framed canvas print on the wall.");
    expect(r.ok).toBe(false);
    expect(r.offenders).toEqual(expect.arrayContaining(["canvas", "framed"]));
  });

  it("flags ghosted / transparent overlay wording", () => {
    const r = checkResponseMedium("A ghosted transparent overlay of the drawing over the silo.");
    expect(r.ok).toBe(false);
    expect(r.offenders.length).toBeGreaterThan(0);
  });

  it("treats no text as a pass", () => {
    expect(checkResponseMedium(null).ok).toBe(true);
  });
});
