import { describe, expect, it } from "vitest";
import { resolveMetaLoadingState } from "./metaLoading";

describe("meta loading state", () => {
  it("lets the confirmed Insights snapshot render while auxiliary blocks finish", () => {
    expect(resolveMetaLoadingState({
      insightsPending: false,
      accountsPending: false,
      coveragePending: false,
      actionsPending: true,
      breakdownsPending: true,
      hasUsableSnapshot: true,
    })).toEqual({
      isLoading: false,
      auxiliaryLoading: true,
    });
  });

  it("keeps the first load pending until the core snapshot is ready", () => {
    expect(resolveMetaLoadingState({
      insightsPending: true,
      accountsPending: false,
      coveragePending: false,
      actionsPending: false,
      breakdownsPending: false,
      hasUsableSnapshot: false,
    })).toEqual({
      isLoading: true,
      auxiliaryLoading: false,
    });
  });
});
