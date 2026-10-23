import { describe, expect, it } from "vitest";
import { resolveMetaSnapshotDuringRefresh } from "./metaSnapshot";

describe("resolveMetaSnapshotDuringRefresh", () => {
  it("preserva o snapshot anterior durante um refetch no mesmo escopo", () => {
    const previous = { leads: 46, cpl: 33.07, metricAvailability: { leads: { available: true } } };
    const current = { leads: 0, cpl: 0, metricAvailability: { leads: { available: false } } };

    expect(resolveMetaSnapshotDuringRefresh({ current, previous, isRefreshing: true, sameScope: true })).toEqual({
      value: previous,
      preserved: true,
    });
  });

  it("não inventa snapshot quando não há dados anteriores", () => {
    const current = { leads: 0, metricAvailability: { leads: { available: false } } };

    expect(resolveMetaSnapshotDuringRefresh({ current, previous: undefined, isRefreshing: true, sameScope: true })).toEqual({
      value: current,
      preserved: false,
    });
  });

  it("não vaza dados de outro recorte", () => {
    const previous = { leads: 46 };
    const current = { leads: 0 };

    expect(resolveMetaSnapshotDuringRefresh({ current, previous, isRefreshing: true, sameScope: false })).toEqual({
      value: current,
      preserved: false,
    });
  });
});
