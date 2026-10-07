import { describe, expect, it } from "vitest";
import {
  buildProjectionRule,
  parsePlacementVerdict,
  parseWallGeometry,
  solveMuralQuad,
} from "../wall-geometry";

const reply =
  '{"surface":"brick wall","quad":{"tl":{"x":0.2,"y":0.1},"tr":{"x":0.9,"y":0.2},"br":{"x":0.9,"y":0.8},"bl":{"x":0.2,"y":0.9}},"occluders":[{"x":0.5,"y":0,"w":0.02,"h":1,"label":"pole"}],"confidence":0.8}';

describe("wall projection mapping", () => {
  it("parses a valid quad", () => {
    expect(parseWallGeometry(reply)?.occluders[0]?.label).toBe("pole");
  });
  it("rejects degenerate / flipped quads", () => {
    expect(
      parseWallGeometry(
        '{"quad":{"tl":{"x":0.9,"y":0},"tr":{"x":0.1,"y":0},"br":{"x":1,"y":1},"bl":{"x":0,"y":1}}}',
      ),
    ).toBeNull();
    expect(
      parseWallGeometry(
        '{"quad":{"tl":{"x":0,"y":0},"tr":{"x":0.1,"y":0},"br":{"x":0.1,"y":0.1},"bl":{"x":0,"y":0.1}}}',
      ),
    ).toBeNull();
  });
  it("keeps the solved mural quad inside the wall quad", () => {
    const g = parseWallGeometry(reply)!;
    for (const a of [0.5, 1, 2.5]) {
      const m = solveMuralQuad(g.quad, a);
      for (const p of [m.tl, m.tr, m.br, m.bl]) {
        expect(p.x).toBeGreaterThanOrEqual(0.2);
        expect(p.x).toBeLessThanOrEqual(0.9);
        expect(p.y).toBeGreaterThanOrEqual(0.1);
        expect(p.y).toBeLessThanOrEqual(0.9);
      }
    }
  });
  it("emits coordinates, and a safe fallback without measurement", () => {
    expect(buildProjectionRule(parseWallGeometry(reply))).toMatch(/TL \(20%, 10%\)/);
    expect(buildProjectionRule(null)).toContain("PROJECTION TARGET");
  });
  it("flags off-wall verdicts", () => {
    expect(parsePlacementVerdict('{"onWall":false,"issues":["paint on sky"]}')?.ok).toBe(false);
    expect(parsePlacementVerdict('{"onWall":true,"issues":[]}')?.ok).toBe(true);
  });
});
