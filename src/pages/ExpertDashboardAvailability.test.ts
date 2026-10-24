import { describe, expect, it } from "vitest";
import { queryMetricAvailability } from "./ExpertDashboard";

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

  it("only reports confirmed empty after loading has settled", () => {
    expect(queryMetricAvailability({
      hasSnapshot: true,
      hasRows: false,
      isLoading: false,
      isFetching: false,
      isError: false,
    })).toEqual({ state: "empty_confirmed" });
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
