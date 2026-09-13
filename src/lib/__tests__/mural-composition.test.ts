import { describe, expect, it, vi } from "vitest";
import {
  assertPromptIntegrity,
  buildMuralPrompt,
  findMissingPromptMarkers,
  GOLDEN_GEOMETRY,
  LAYOUT_TEMPLATES,
  REQUIRED_MULTI_MARKERS,
} from "../mural-prompt";
import { hashPrompt, formatRenderLog, newCorrelationId } from "../render-log";
import { parseMediumVerdict } from "../mural-classifier";

const scene = "Place the artwork on a weathered concrete facade. Photorealistic, no text.";
const build = (artworkCount: number, layoutIndex = 0) =>
  buildMuralPrompt({ scenePrompt: scene, artworkCount, hasWall: true, layoutIndex });

describe("golden ratio / fibonacci / rule-of-thirds geometry", () => {
  it("is absent for a single artwork", () => {
    expect(build(1)).not.toContain(GOLDEN_GEOMETRY);
  });

  for (const n of [2, 3]) {
    it(`is present for ${n} artworks on one wall`, () => {
      const p = build(n);
      expect(p).toContain(GOLDEN_GEOMETRY);
      expect(findMissingPromptMarkers(p, n)).toEqual([]);
    });
  }

  it("carries every multi-artwork marker for 3 artworks in each layout", () => {
    for (let i = 0; i < 3; i++) {
      const p = build(3, i);
      for (const m of REQUIRED_MULTI_MARKERS) {
        expect(p, `layout ${i} missing ${m.id}`).toContain(m.needle);
      }
    }
  });

  it("every 3-artwork layout template names a proportion system", () => {
    for (const t of LAYOUT_TEMPLATES[3]!) {
      expect(t).toMatch(/golden|Fibonacci|8 : 5 : 3|thirds|spiral/i);
    }
  });

  it("guard throws when the proportion system is stripped from a 3-artwork prompt", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = build(3).replace(GOLDEN_GEOMETRY, "");
    expect(() => assertPromptIntegrity(broken, "test", 3)).toThrow(/GOLDEN_GEOMETRY/);
    vi.restoreAllMocks();
  });
});

describe("post-render medium classifier verdicts", () => {
  it("accepts a clean hand-painted verdict", () => {
    const v = parseMediumVerdict(
      '{"ok": true, "medium": "hand-painted aerosol mural", "issues": [], "confidence": 0.92}',
    );
    expect(v?.ok).toBe(true);
    expect(v?.confidence).toBeCloseTo(0.92);
  });

  it("fails when the image shows a pasted print", () => {
    const v = parseMediumVerdict(
      'Here you go: {"ok": false, "medium": "pasted poster print", "issues": ["rectangular white margin"], "confidence": 0.8}',
    );
    expect(v?.ok).toBe(false);
    expect(v?.issues).toContain("rectangular white margin");
  });

  it("overrides an optimistic ok when the label itself is a wrong medium", () => {
    const v = parseMediumVerdict('{"ok": true, "medium": "semi-transparent overlay", "issues": []}');
    expect(v?.ok).toBe(false);
  });

  it("fails when issues are reported despite ok:true", () => {
    const v = parseMediumVerdict('{"ok": true, "medium": "mural", "issues": ["ghosting visible"]}');
    expect(v?.ok).toBe(false);
  });

  it("degrades to null on unparseable output", () => {
    expect(parseMediumVerdict("sorry, I cannot help")).toBeNull();
    expect(parseMediumVerdict(null)).toBeNull();
  });
});

describe("structured render logging", () => {
  it("mints unique correlation ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newCorrelationId()));
    expect(ids.size).toBe(50);
  });

  it("hashes prompt content stably and sensitively", () => {
    const a = build(3);
    expect(hashPrompt(a)).toBe(hashPrompt(a));
    expect(hashPrompt(a)).not.toBe(hashPrompt(a + " "));
  });

  it("formats a line with correlation id, prompt hash and medium result", () => {
    const line = formatRenderLog({
      cid: "r_test",
      event: "medium-classifier",
      scene: "container-0",
      promptHash: "deadbeef",
      medium: "wrong",
      offenders: ["poster"],
    });
    expect(line).toContain("cid=r_test");
    expect(line).toContain("promptHash=deadbeef");
    expect(line).toContain("medium=wrong");
    expect(line).toContain("offenders=poster");
  });
});
