import { describe, expect, it } from "vitest";
import { extractKeys } from "../key-extract";

const pasted = `apis
huggingface
hf_abcdefghijklmnopqrstuvwxyz12
gemini key AIzaSyA1234567890abcdefghijklmnopqrstu
recraft
lovable-mockups: wH1Bpk54T9nksaZMZzyUwIrnCnviWoa5i225ACihU9KsNcthMFIpCE98D4vAwqbQ
fal mockups: fal_sk_57b58022dc90445592bbb14d74b45aff:52daf164e15df898d39e7d0ea7a8df5b
842368681657173
CLOUDINARY_URL=cloudinary://1234:abcSecret9@demo`;

describe("extractKeys", () => {
  const found = extractKeys(pasted);
  const by = (p: string) => found.filter((f) => f.provider === p);

  it("detects Hugging Face, Google and fal keys as usable", () => {
    expect(by("huggingface")[0]?.usable).toBe(true);
    expect(by("google")[0]?.usable).toBe(true);
    expect(by("fal")[0]?.key).toMatch(/^fal_sk_/);
  });

  it("flags Recraft and Cloudinary as not usable for mockups", () => {
    expect(by("recraft")[0]?.usable).toBe(false);
    expect(by("cloudinary")[0]?.usable).toBe(false);
  });

  it("ignores plain numbers and words", () => {
    expect(found.some((f) => f.key === "842368681657173")).toBe(false);
    expect(found.some((f) => f.key === "CLOUDINARY_URL")).toBe(false);
  });
});
