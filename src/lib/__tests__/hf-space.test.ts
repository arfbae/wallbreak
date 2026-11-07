import { describe, expect, it } from "vitest";
import { callHfSpace, HF_SPACE_ORIGIN, spaceInputs, spaceSupportsRequest } from "../hf-space";
import { buildResourcePlan, renderImageWithFailover, resetHealth } from "../generation-router";

describe("official free Space", () => {
  it("accepts artwork plus wall but skips three artworks plus wall", () => {
    expect(spaceSupportsRequest(["a"], "w")).toBe(true);
    expect(spaceSupportsRequest(["a", "b"], "w")).toBe(true);
    expect(spaceSupportsRequest(["a", "b", "c"], "w")).toBe(false);
  });
  it("preserves every image and the exact prompt, without rewriting", () => {
    const data = spaceInputs([{ path: "art1", mime: "image/png" }, { path: "art2", mime: "image/png" }, { path: "wall", mime: "image/png" }], "exact full brief");
    expect(data[0]).toHaveLength(3); expect(data[1]).toBe("exact full brief"); expect(data[8]).toBe(false);
    expect(() => spaceInputs(Array.from({ length: 4 }, () => ({ path: "a", mime: "image/png" })), "brief")).toThrow();
  });
  it("uploads all references once, then consumes the completed queue result", async () => {
    const urls: string[] = [];
    const mockFetch = (async (url, init) => {
      urls.push(String(url));
      if (String(url).endsWith("upload")) { expect((init?.body as FormData).getAll("files")).toHaveLength(2); return Response.json(["/tmp/art", "/tmp/wall"]); }
      if (String(url).endsWith("/infer")) { const data = JSON.parse(String(init?.body)).data; expect(data[0]).toHaveLength(2); expect(data[1]).toBe("complete prompt"); return Response.json({ event_id: "job1" }); }
      return new Response(`event: heartbeat\ndata: null\n\nevent: complete\ndata: [[{"image":{"url":"${HF_SPACE_ORIGIN}/gradio_api/file=result.png"}}],0]\n\n`);
    }) as typeof fetch;
    const out = await callHfSpace(["data:image/png;base64,QQ==", "data:image/png;base64,Qg=="], "complete prompt", "synthetic-token", mockFetch);
    expect(out.ok).toBe(true); expect((await out.json()).images[0].url).toContain("result.png"); expect(urls).toHaveLength(3);
  });
  it("never queues an over-limit mural or drops its wall", async () => {
    resetHealth(); let calls = 0;
    const out = await renderImageWithFailover({ artworkDataUrls: ["a", "b", "c"], wallDataUrl: "w", prompt: "complete wall mural instructions preserved across every attempt" }, buildResourcePlan([{ provider: "hfspace", label: "test", key: "synthetic" }]), { fetchImpl: (async () => { calls++; return Response.json({}); }) as typeof fetch });
    expect(out.ok).toBe(false); expect(calls).toBe(0);
  });
  it("does not requeue after the free allowance is refused", async () => {
    resetHealth(); let calls = 0;
    const out = await renderImageWithFailover({ artworkDataUrls: ["data:image/png;base64,QQ=="], wallDataUrl: null, prompt: "complete wall mural instructions preserved across every attempt" }, buildResourcePlan([{ provider: "hfspace", label: "test", key: "synthetic" }]), { fetchImpl: (async () => { calls++; return new Response("daily quota", { status: 429 }); }) as typeof fetch });
    expect(out.ok).toBe(false); expect(calls).toBe(1);
  });
});