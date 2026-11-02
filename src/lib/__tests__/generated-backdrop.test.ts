import { describe, expect, it } from "vitest";
import {
  buildIsolationRule,
  GENERATED_BACKDROP_RULE,
  ISOLATION_PROMPT,
  needsGeneratedBackdrop,
  parseArtworkAnalysis,
} from "../artwork-analysis";

const reply = (hasOwnBackground: unknown) =>
  parseArtworkAnalysis(
    JSON.stringify({ kind: "clean-artwork", subject: "fox", confidence: 0.9, hasOwnBackground }),
  );

describe("generated backdrop when the artwork has none", () => {
  it("adds the backdrop rule in both background modes when none is detected", () => {
    const a = reply(false);
    expect(needsGeneratedBackdrop(a)).toBe(true);
    for (const keep of [true, false]) {
      const rule = buildIsolationRule([a], keep);
      expect(rule).toContain(GENERATED_BACKDROP_RULE);
      expect(rule).toContain("Artwork 1 has no background of its own");
    }
  });

  it("does not add a backdrop when the artwork already has its own background", () => {
    expect(buildIsolationRule([reply(true)], true)).not.toContain("GENERATED BACKDROP");
  });

  it("does not add a backdrop when detection is unknown or unavailable", () => {
    expect(needsGeneratedBackdrop(reply("maybe"))).toBe(false);
    expect(buildIsolationRule([null])).not.toContain("GENERATED BACKDROP");
  });

  it("the backdrop is built from the artwork's palette and stays on the wall without new subjects", () => {
    expect(GENERATED_BACKDROP_RULE).toContain("artwork's own palette");
    expect(GENERATED_BACKDROP_RULE).toContain("inside the same paintable wall area");
    expect(GENERATED_BACKDROP_RULE).toContain("no new figures");
  });

  it("source analysis asks whether a background exists", () => {
    expect(ISOLATION_PROMPT).toContain('"hasOwnBackground": boolean');
  });
});
