import { describe, expect, it } from "vitest";
import { buildDashboardMetricAvailability } from "./dashboardMetricAvailability";

describe("buildDashboardMetricAvailability", () => {
  it("marks CTR unavailable while the Meta snapshot is unavailable", () => {
    const result = buildDashboardMetricAvailability({
      isLoading: false,
      hasSnapshot: false,
      rowCount: 0,
      status: "error",
      leadAvailable: false,
      reason: "Meta indisponível",
      revenueAvailability: { state: "fresh" },
    });

    expect(result.ctr).toEqual({ state: "unavailable", reason: "Meta indisponível" });
    expect(result.conversion_rate).toEqual({ state: "unavailable", reason: "Meta indisponível" });
  });

  it("keeps CTR stale while a confirmed snapshot is being refreshed", () => {
    const result = buildDashboardMetricAvailability({
      isLoading: false,
      hasSnapshot: true,
      rowCount: 12,
      status: "syncing",
      leadAvailable: true,
      reason: null,
      revenueAvailability: { state: "fresh" },
    });

    expect(result.ctr).toEqual({ state: "stale", reason: "Atualizando Meta em segundo plano; o último snapshot permanece visível." });
    expect(result.conversion_rate).toEqual({ state: "stale", reason: "Atualizando Meta em segundo plano; o último snapshot permanece visível." });
  });

  it("marks a previous CTR snapshot partial when the refresh fails", () => {
    const result = buildDashboardMetricAvailability({
      isLoading: false,
      hasSnapshot: true,
      rowCount: 12,
      status: "error",
      leadAvailable: true,
      reason: "Meta temporariamente indisponível",
      revenueAvailability: { state: "fresh" },
    });

    expect(result.ctr).toEqual({ state: "partial", reason: "Meta temporariamente indisponível" });
  });
});
