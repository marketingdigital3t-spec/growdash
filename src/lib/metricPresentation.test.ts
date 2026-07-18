import { describe, expect, it } from "vitest";
import { formatMetric, metricDescription } from "./metricPresentation";

describe("metricPresentation", () => {
  it("nunca exibe casas decimais em contagens", () => {
    expect(formatMetric(45, "count")).toBe("45");
    expect(formatMetric(1227.2, "count")).toBe("1.227");
  });

  it("preserva duas casas em valores monetários", () => {
    expect(formatMetric(45, "currency")).toContain("45,00");
  });

  it("entrega uma explicação para métricas conhecidas e desconhecidas", () => {
    expect(metricDescription("CPL")).toContain("Custo por lead");
    expect(metricDescription("Métrica customizada")).toContain("Métrica customizada");
  });
});
