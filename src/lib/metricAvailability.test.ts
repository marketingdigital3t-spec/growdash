import { describe, expect, it } from "vitest";
import { displayMetricValue, isMetricAvailable, type MetricAvailability } from "./metricAvailability";

describe("metricAvailability", () => {
  const formatter = (value: number) => `R$ ${value.toFixed(2)}`;

  it("não transforma valor pendente em zero", () => {
    const loading: MetricAvailability = { state: "loading" };
    const unavailable: MetricAvailability = { state: "unavailable", reason: "RD indisponível" };

    expect(displayMetricValue(0, loading, formatter)).toBe("Carregando…");
    expect(displayMetricValue(0, unavailable, formatter)).toBe("Indisponível");
    expect(isMetricAvailable(loading)).toBe(false);
    expect(isMetricAvailable(unavailable)).toBe(false);
  });

  it("preserva o valor quando existe snapshot fresco, parcial ou antigo", () => {
    expect(displayMetricValue(0, { state: "fresh" }, formatter)).toBe("R$ 0.00");
    expect(displayMetricValue(76500, { state: "partial", reason: "RD atrasado" }, formatter)).toBe("R$ 76500.00");
    expect(displayMetricValue(76500, { state: "stale", updatedAt: "2026-10-23T12:00:00Z" }, formatter)).toBe("R$ 76500.00");
    expect(isMetricAvailable({ state: "partial" })).toBe(true);
    expect(isMetricAvailable({ state: "stale" })).toBe(true);
  });

  it("permite zero somente quando a fonte confirmou ausência de registros", () => {
    expect(displayMetricValue(0, { state: "empty_confirmed" }, formatter)).toBe("R$ 0.00");
    expect(isMetricAvailable({ state: "empty_confirmed" })).toBe(true);
  });
});
