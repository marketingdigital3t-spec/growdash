import { describe, expect, it } from "vitest";
import { goalColorForPercentage, goalPercentage, goalProgress } from "@/lib/monthlyGoal";

describe("monthly goal presentation", () => {
  it("clamps a valid progress value to the visible bar", () => {
    expect(goalProgress(0, 10)).toBe(0);
    expect(goalProgress(5, 10)).toBe(50);
    expect(goalProgress(12, 10)).toBe(100);
    expect(goalPercentage(12, 10)).toBe(120);
    expect(goalProgress(10, 0)).toBe(0);
  });

  it("moves continuously from red through yellow to green", () => {
    expect(goalColorForPercentage(0)).toBe("rgb(239 68 68)");
    expect(goalColorForPercentage(50)).toBe("rgb(245 158 11)");
    expect(goalColorForPercentage(80)).toBe("rgb(34 197 94)");
    expect(goalColorForPercentage(100)).toBe("rgb(34 197 94)");
    expect(goalColorForPercentage(150)).toBe("rgb(34 197 94)");
  });
});
