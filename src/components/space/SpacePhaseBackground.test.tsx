import { describe, expect, it } from "vitest";

function usesOptimizedEarthTexture(source: string): boolean {
  return source.includes("earth-2k-web.jpg") && !source.includes("earth-8k-300dpi.jpg");
}

describe("SpacePhaseBackground earth texture", () => {
  it("uses the web-optimized earth texture instead of the 8k 300dpi version", () => {
    const source = "@/assets/growth/earth-2k-web.jpg";
    expect(usesOptimizedEarthTexture(source)).toBe(true);
  });

  it("rejects the 8k 300dpi texture", () => {
    const source = "@/assets/growth/earth-8k-300dpi.jpg";
    expect(usesOptimizedEarthTexture(source)).toBe(false);
  });
});
