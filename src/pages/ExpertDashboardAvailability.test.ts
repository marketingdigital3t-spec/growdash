import { describe, expect, it } from "vitest";
import { buildExpertMetricAvailability, hasActionMetricSnapshot, queryMetricAvailability } from "./ExpertDashboard";

describe("Expert dashboard metric availability", () => {
  it("keeps disabled queries in loading while account scope is hydrating", () => {
    expect(queryMetricAvailability({
      hasSnapshot: false,
      hasRows: false,
      isLoading: true,
      isFetching: false,
      isError: false,
    })).toEqual({ state: "loading" });
  });

  it("does not confirm empty while a dependency is still pending", () => {
    expect(queryMetricAvailability({
      hasSnapshot: false,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      dependencyPending: true,
    })).toEqual({ state: "loading" });
  });

  it("keeps a dependency error unavailable even when the dependent query is disabled", () => {
    expect(queryMetricAvailability({
      hasSnapshot: false,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      dependencyError: "Meta indisponível",
    })).toEqual({ state: "unavailable", reason: "Meta indisponível" });
  });

  it("only reports confirmed empty after loading has settled", () => {
    expect(queryMetricAvailability({
      hasSnapshot: true,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
    })).toEqual({ state: "empty_confirmed" });
  });

  it("keeps a dependent metric loading when an empty action object arrived before insights", () => {
    expect(hasActionMetricSnapshot({ hasActionData: true, actionAdCount: 0, insightsDataUpdatedAt: 0 })).toBe(false);
    expect(queryMetricAvailability({
      hasSnapshot: false,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      dependencyPending: true,
    })).toEqual({ state: "loading" });
  });

  it("preserves a real action snapshot as stale while its insight dependency refreshes", () => {
    expect(hasActionMetricSnapshot({ hasActionData: true, actionAdCount: 0, insightsDataUpdatedAt: 123 })).toBe(true);
    expect(queryMetricAvailability({
      hasSnapshot: true,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      dependencyPending: true,
    })).toEqual({ state: "stale", reason: "Atualizando a fonte de dependência; o último snapshot permanece visível." });
  });

  it("marks a preserved dependent snapshot partial when its dependency fails", () => {
    expect(queryMetricAvailability({
      hasSnapshot: true,
      hasRows: true,
      isLoading: false,
      isFetching: false,
      isError: false,
      dependencyError: "Meta indisponível",
    })).toEqual({ state: "partial", reason: "Meta indisponível" });
  });

  it("uses the lead availability state for the derived conversion KPI", () => {
    const leadAvailability = { state: "loading" as const };
    const revenueAvailability = { state: "fresh" as const };
    const availability = buildExpertMetricAvailability({
      insightAvailability: { state: "loading" },
      leadAvailability,
      revenueAvailability,
    });
    expect(availability.conversion_rate).toEqual(leadAvailability);
  });

  it("preserves a partial snapshot when a refresh fails", () => {
    expect(queryMetricAvailability({
      hasSnapshot: true,
      hasRows: true,
      isLoading: false,
      isFetching: false,
      isError: true,
      reason: "Fonte indisponível",
    })).toEqual({ state: "partial", reason: "Fonte indisponível" });
  });
});
