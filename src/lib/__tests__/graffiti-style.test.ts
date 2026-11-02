import { describe, expect, it } from "vitest";
import {
  GRAFFITI_ANALYSIS_GUIDANCE,
  GRAFFITI_RENDER_GUIDANCE,
  graffitiAnalysisRule,
  parseGraffitiAnalysis,
} from "../graffiti-style";
import { buildIsolationRule, ISOLATION_PROMPT, parseArtworkAnalysis } from "../artwork-analysis";
import { buildMuralPrompt, findMissingPromptMarkers } from "../mural-prompt";

const piece = {
  style: "standard-piece",
  text: "SKORE",
  textConfidence: 0.95,
  layers: ["background cloud", "3D extrusion", "fill", "keyline"],
  extrusion: "converging",
  characterIntegration: "character's arm wraps the K",
  preservationNotes: ["shared spine between S and K"],
};

const analysisReply = (graffiti: unknown) =>
  JSON.stringify({
    kind: "photo-of-artwork",
    bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    subject: "graffiti piece",
    removeBackground: true,
    discard: ["phone frame"],
    confidence: 0.9,
    graffiti,
  });

describe("graffiti lettering is never guessed", () => {
  it("keeps clearly legible lettering (confidence >= 0.9)", () => {
    const g = parseGraffitiAnalysis(piece);
    expect(g?.text).toBe("SKORE");
    expect(graffitiAnalysisRule(g, 0)).toContain('"SKORE"; preserve exactly');
  });

  it("drops lettering read with confidence below 0.9", () => {
    const g = parseGraffitiAnalysis({ ...piece, textConfidence: 0.89 });
    expect(g?.text).toBeNull();
    const rule = graffitiAnalysisRule(g, 0);
    expect(rule).not.toContain("SKORE");
    expect(rule).toContain("do not guess a word");
  });

  it("never carries text for non-graffiti images", () => {
    const g = parseGraffitiAnalysis({ ...piece, style: "not-graffiti" });
    expect(g?.text).toBeNull();
  });
});

describe("graffiti rules only apply to graffiti", () => {
  it("emits no artwork-specific rule for not-graffiti or unclear sources", () => {
    expect(graffitiAnalysisRule(parseGraffitiAnalysis({ style: "not-graffiti" }), 0)).toBe("");
    expect(graffitiAnalysisRule(parseGraffitiAnalysis({ style: "unclear" }), 0)).toBe("");
    expect(graffitiAnalysisRule(parseGraffitiAnalysis({ style: "wildstyle-ish" }), 0)).toBe("");
    expect(graffitiAnalysisRule(null, 0)).toBe("");
  });

  it("an underwater drawing gets no graffiti line in the isolation rule", () => {
    const a = parseArtworkAnalysis(analysisReply({ style: "not-graffiti" }));
    expect(buildIsolationRule([a])).not.toContain("graffiti analysis");
  });

  it("the shared render guidance is explicitly conditional", () => {
    expect(GRAFFITI_RENDER_GUIDANCE).toContain("only for graffiti artwork");
    expect(GRAFFITI_RENDER_GUIDANCE).toContain("instead of imposing graffiti on unrelated images");
  });
});

describe("background choice is respected for graffiti pieces", () => {
  const a = parseArtworkAnalysis(analysisReply(piece));

  it("keep-background mode keeps the cloud and adds the piece analysis", () => {
    const rule = buildIsolationRule([a], true);
    expect(rule).toContain("keep-background mode");
    expect(rule).toContain("Artwork 1 graffiti analysis");
    expect(rule).toContain("background cloud");
  });

  it("remove-background mode discards surroundings but still adds the piece analysis", () => {
    const rule = buildIsolationRule([a], false);
    expect(rule).toContain("discard its surrounding background entirely");
    expect(rule).toContain("Artwork 1 graffiti analysis");
  });

  it("guidance covers both background choices", () => {
    expect(GRAFFITI_RENDER_GUIDANCE).toContain(
      "When backgrounds are kept preserve intentional clouds",
    );
    expect(GRAFFITI_RENDER_GUIDANCE).toContain(
      "When backgrounds are removed omit backdrop clouds/washes but preserve structural keylines",
    );
  });
});

describe("graffiti guidance is wired into the pipeline", () => {
  it("source analysis asks for the graffiti breakdown", () => {
    expect(ISOLATION_PROMPT).toContain(GRAFFITI_ANALYSIS_GUIDANCE);
    expect(ISOLATION_PROMPT).toContain('"graffiti"');
  });

  it("every assembled mural prompt carries the preservation rule before composition", () => {
    for (const n of [1, 2, 3]) {
      const p = buildMuralPrompt({ scenePrompt: "wall", artworkCount: n, hasWall: true });
      expect(findMissingPromptMarkers(p, n)).toEqual([]);
      const g = p.indexOf("GRAFFITI STRUCTURE PRESERVATION");
      expect(g).toBeGreaterThan(p.indexOf("ARTWORK ISOLATION"));
      expect(g).toBeLessThan(p.indexOf("COMPOSITION LOGIC"));
    }
  });

  it("painted 3D never licenses paint off the wall", () => {
    expect(GRAFFITI_RENDER_GUIDANCE).toContain("painted 3D never licenses paint outside the wall");
    expect(GRAFFITI_RENDER_GUIDANCE).toContain("never override subject fidelity");
  });
});
