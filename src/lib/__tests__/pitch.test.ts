import { describe, expect, it } from "vitest";
import { emailDraftBlob, mailtoDraft, pitchFactsText } from "../pitch";
import { panFrame, WALKTHROUGH_SECONDS } from "../walkthrough";

describe("pitch facts and email export", () => {
  it("preserves the supplied quote and timeline", () => {
    const facts = pitchFactsText({ clientName: "Client", projectTitle: "Mural", location: "", wallDimensions: "12 × 6 m", timeline: "3 weeks", budget: "$18,500 AUD + GST", notes: "" });
    expect(facts).toContain("budget: $18,500 AUD + GST");
    expect(facts).toContain("timeline: 3 weeks");
  });
  it("encodes draft text without adding mail recipients", () => {
    expect(mailtoDraft("a@example.com", "A & B", "Paint\nQuote")).toBe("mailto:a%40example.com?subject=A%20%26%20B&body=Paint%0AQuote");
  });
  it("prevents injected email headers", async () => {
    expect(await emailDraftBlob("a@example.com\r\nBcc: b@example.com", "Pitch", "Hi").text()).not.toContain("\r\nBcc:");
  });
});
describe("exact-image walkthrough", () => {
  it("records eight seconds", () => expect(WALKTHROUGH_SECONDS).toBe(8));
  it("covers the frame through the full pan", () => {
    for (const p of [0, .25, .5, .75, 1]) {
      const f = panFrame(1280, 720, p);
      expect(f.x).toBeLessThanOrEqual(0); expect(f.y).toBeLessThanOrEqual(0);
      expect(f.x + f.width).toBeGreaterThanOrEqual(1280); expect(f.y + f.height).toBeGreaterThanOrEqual(720);
    }
  });
});