import { beforeEach, describe, expect, it } from "vitest";
import {
  buildResourcePlan,
  isUsable,
  renderImageWithFailover,
  resetHealth,
  type MuralRequest,
} from "../generation-router";

const req: MuralRequest = {
  prompt: "Paint the artwork as a fully opaque mural on the wall plane, photorealistic.",
  artworkDataUrls: ["data:image/png;base64,AAA"],
  wallDataUrl: "data:image/png;base64,BBB",
};
const creds = [
  { key: "k1", label: "key 1" },
  { key: "k2", label: "key 2" },
];
const ok = () =>
  new Response(
    JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: "data:img" } }] } }] }),
    { status: 200 },
  );
const noSleep = async () => {};

describe("generation router", () => {
  beforeEach(() => resetHealth());

  it("fails over to the next credential on 401 and resends the full request", async () => {
    const bodies: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return bodies.length === 1 ? new Response("bad", { status: 401 }) : ok();
    }) as typeof fetch;
    const out = await renderImageWithFailover(req, buildResourcePlan(creds), {
      fetchImpl,
      sleep: noSleep,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.resource.credential.label).toBe("key 2");
    for (const b of bodies) {
      expect(b).toContain(req.prompt);
      expect(b).toContain("BBB");
      expect(b).toContain("AAA");
    }
  });

  it("cools down a rate-limited resource and moves on", async () => {
    let n = 0;
    const fetchImpl = (async () => (++n === 1 ? new Response("", { status: 429 }) : ok())) as typeof fetch;
    const plan = buildResourcePlan(creds);
    const out = await renderImageWithFailover(req, plan, { fetchImpl, sleep: noSleep });
    expect(out.ok).toBe(true);
    expect(isUsable(plan[0]!.id)).toBe(false);
  });

  it("returns a safe message when everything fails", async () => {
    const fetchImpl = (async () => new Response("", { status: 503 })) as typeof fetch;
    const out = await renderImageWithFailover(req, buildResourcePlan(creds, ["m"]), {
      fetchImpl,
      sleep: noSleep,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).not.toMatch(/503/);
  });

  it("refuses an incomplete mural request", async () => {
    await expect(
      renderImageWithFailover({ ...req, artworkDataUrls: [] }, buildResourcePlan(creds)),
    ).rejects.toThrow();
  });
});
