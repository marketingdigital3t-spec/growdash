import { describe, expect, it } from "vitest";
import { isRecoverableChunkError } from "./resilience";

describe("resilience helpers", () => {
  it("recognizes transient chunk failures after a deploy", () => {
    expect(isRecoverableChunkError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isRecoverableChunkError(new Error("Loading chunk 42 failed"))).toBe(true);
  });

  it("does not classify a normal application error as a cache failure", () => {
    expect(isRecoverableChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});
