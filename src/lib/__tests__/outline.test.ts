import { describe, expect, it } from "vitest";
import { outlinePixels } from "../outline";

function scene() {
  const width = 100;
  const height = 60;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  // Distinct subjects on both sides, including surroundings outside the mural.
  for (const [left, top, right, bottom] of [[10, 10, 30, 40], [65, 20, 90, 50]]) {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
  }
  return { pixels, width, height };
}

describe("full-scene outline", () => {
  it("retains dimensions, outlines both scene objects, and produces only opaque black and white", () => {
    const { pixels, width, height } = scene();
    const before = pixels.slice();
    const output = outlinePixels(pixels, width, height);
    expect(output.length).toBe(pixels.length);
    expect(pixels).toEqual(before);
    let left = 0;
    let right = 0;
    for (let i = 0; i < output.length; i += 4) {
      expect([0, 255]).toContain(output[i]);
      expect(output[i + 1]).toBe(output[i]);
      expect(output[i + 2]).toBe(output[i]);
      expect(output[i + 3]).toBe(255);
      if (output[i] === 0) { if ((i / 4) % width < width / 2) left++; else right++; }
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(output[(25 * width + 20) * 4]).toBe(255);
  });
  it("increases contour thickness without cropping", () => {
    const { pixels, width, height } = scene();
    const count = (data: Uint8ClampedArray) => data.filter((v, i) => i % 4 === 0 && v === 0).length;
    expect(count(outlinePixels(pixels, width, height, 65, 3))).toBeGreaterThan(count(outlinePixels(pixels, width, height, 65, 1)));
  });
  it("keeps blank scenes white and rejects unreadable data", () => {
    expect(outlinePixels(new Uint8ClampedArray(40 * 40 * 4).fill(255), 40, 40).every((v) => v === 255)).toBe(true);
    expect(() => outlinePixels(new Uint8ClampedArray(2), 40, 40)).toThrow("could not be read");
  });
});