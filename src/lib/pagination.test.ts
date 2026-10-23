import { describe, expect, it } from "vitest";
import { shouldFetchNextPage } from "./pagination";

describe("pagination", () => {
  it("continua depois de uma página cheia e para na página curta", () => {
    expect(shouldFetchNextPage(1000, 1000)).toBe(true);
    expect(shouldFetchNextPage(37, 1000)).toBe(false);
    expect(shouldFetchNextPage(0, 1000)).toBe(false);
  });
});
