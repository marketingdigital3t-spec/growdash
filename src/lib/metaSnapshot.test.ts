import { describe, expect, it } from "vitest";
import { resolveMetaSnapshotDuringRefresh, resolvePersistedSnapshot } from "./metaSnapshot";

describe("resolveMetaSnapshotDuringRefresh", () => {
  it("aceita um snapshot persistido somente quando o escopo é idêntico", () => {
    const snapshot = { scopeKey: "user-1|account-1|2026-10-25", savedAt: "2026-10-25T10:00:00.000Z", value: { spend: 1521.45 } };
    expect(resolvePersistedSnapshot(snapshot, snapshot.scopeKey)).toEqual(snapshot.value);
    expect(resolvePersistedSnapshot(snapshot, "user-1|account-2|2026-10-25")).toBeUndefined();
  });

  it("ignora registros persistidos incompletos para não fabricar uma métrica", () => {
    expect(resolvePersistedSnapshot({ scopeKey: "scope", savedAt: "", value: null }, "scope")).toBeUndefined();
    expect(resolvePersistedSnapshot({ scopeKey: "scope", savedAt: "2026-10-25T10:00:00.000Z" }, "scope")).toBeUndefined();
  });

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
