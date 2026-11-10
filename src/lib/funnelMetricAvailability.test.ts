import { describe, expect, it } from "vitest";
import { buildFunnelMetricAvailability, hasRenderableFunnelStages } from "./funnelMetricAvailability";

const base = {
  hasMetaSnapshot: false,
  metaLoading: false,
  metaUnavailable: false,
  hasRDSnapshot: false,
  rdLoading: false,
  rdError: false,
  rdSyncing: false,
};

describe("buildFunnelMetricAvailability", () => {
  it("keeps a confirmed Meta snapshot visible while the provider refreshes", () => {
    const result = buildFunnelMetricAvailability({ ...base, hasMetaSnapshot: true, metaLoading: true });
    expect(result.meta.state).toBe("stale");
    expect(result.meta.reason).toContain("segundo plano");
  });

  it("keeps a confirmed RD snapshot visible while the provider refreshes", () => {
    const result = buildFunnelMetricAvailability({ ...base, hasRDSnapshot: true, rdLoading: true });
    expect(result.rd.state).toBe("stale");
  });

  it("does not mark a confirmed snapshot as unavailable when the request fails", () => {
    const result = buildFunnelMetricAvailability({ ...base, hasRDSnapshot: true, rdError: true });
    expect(result.rd.state).toBe("partial");
    expect(result.rd.reason).toContain("snapshot anterior");
  });

  it("reports loading only when no snapshot exists yet", () => {
    const result = buildFunnelMetricAvailability({ ...base, metaLoading: true, rdLoading: true });
    expect(result.meta.state).toBe("loading");
    expect(result.rd.state).toBe("loading");
  });

  it("reports unavailable only when no snapshot exists and the read failed", () => {
    const result = buildFunnelMetricAvailability({ ...base, metaUnavailable: true, rdError: true });
    expect(result.meta.state).toBe("unavailable");
    expect(result.rd.state).toBe("unavailable");
  });

  it("keeps the confirmed snapshot fresh once every refresh finished", () => {
    const result = buildFunnelMetricAvailability({ ...base, hasMetaSnapshot: true, hasRDSnapshot: true });
    expect(result.meta.state).toBe("fresh");
    expect(result.rd.state).toBe("fresh");
  });
});

describe("hasRenderableFunnelStages", () => {
  it("accepts stages recovered from the persisted deal facts", () => {
    expect(hasRenderableFunnelStages(0, 3)).toBe(true);
  });

  it("accepts the persisted stage catalog", () => {
    expect(hasRenderableFunnelStages(4, 0)).toBe(true);
  });

  it("reports no renderable stage only when both sources are empty", () => {
    expect(hasRenderableFunnelStages(0, 0)).toBe(false);
  });
});
