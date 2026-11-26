import { describe, expect, it } from "vitest";
import { goalColorForPercentage, goalPercentage, goalProgress, goalRevenueDisplayState, shouldAnimateGoalProgress } from "@/lib/monthlyGoal";

describe("monthly goal presentation", () => {
  it("does not present zero while the first revenue snapshot is loading", () => {
    expect(goalRevenueDisplayState({ loading: true, error: false, snapshot: false })).toBe("pending");
  });

  it("preserves a previous snapshot when a refresh fails", () => {
    expect(goalRevenueDisplayState({ loading: false, error: true, snapshot: true })).toBe("stale");
    expect(goalRevenueDisplayState({ loading: false, error: true, snapshot: false })).toBe("unavailable");
  });

  it("animates the topbar only when a real goal snapshot is visible", () => {
    expect(shouldAnimateGoalProgress({ target: 100, revenueState: "ready" })).toBe(true);
    expect(shouldAnimateGoalProgress({ target: 100, revenueState: "stale" })).toBe(true);
    expect(shouldAnimateGoalProgress({ target: 100, revenueState: "pending" })).toBe(false);
    expect(shouldAnimateGoalProgress({ target: 100, revenueState: "unavailable" })).toBe(false);
    expect(shouldAnimateGoalProgress({ target: 0, revenueState: "ready" })).toBe(false);
  });

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
