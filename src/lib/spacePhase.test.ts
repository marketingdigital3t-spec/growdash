import { describe, expect, it } from "vitest";
import { getSpacePhase } from "./spacePhase";

describe("space phase progression", () => {
  it("keeps Terra below R$ 50 mil", () => {
    expect(getSpacePhase(0)).toBe("terra");
    expect(getSpacePhase(49_999.99)).toBe("terra");
  });

  it("starts Órbita at R$ 50 mil and keeps R$ 100 mil in Órbita", () => {
    expect(getSpacePhase(50_000)).toBe("orbita");
    expect(getSpacePhase(100_000)).toBe("orbita");
  });

  it("starts Galáxia only above R$ 100 mil", () => {
    expect(getSpacePhase(100_000.01)).toBe("galaxia");
    expect(getSpacePhase(500_000)).toBe("galaxia");
  });

  it("does not promote invalid revenue values", () => {
    expect(getSpacePhase(Number.NaN)).toBe("terra");
    expect(getSpacePhase(Number.POSITIVE_INFINITY)).toBe("terra");
  });
});
