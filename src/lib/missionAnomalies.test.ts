import { describe, expect, it } from "vitest";
import { deriveMissionAnomalies } from "./missionAnomalies";

describe("anomalias da missao derivadas das metricas reais", () => {
  it("nao inventa campanha, etapa ou valor fixo", () => {
    const anomalias = deriveMissionAnomalies({ spend: 100, leads: 10, cpl: 10, sales: 1, revenue: 500 });

    for (const anomalia of anomalias) {
      expect(anomalia.context).not.toMatch(/Black Premium|Lançamento 6\.0|Página de Vendas/);
      expect(anomalia.metric).not.toMatch(/38,45|12\.450|7,11/);
    }
  });

  it("alerta CPL alto com severidade alta", () => {
    const [anomalia] = deriveMissionAnomalies({ spend: 5000, leads: 100, cpl: 80, sales: 5 });

    expect(anomalia.severity).toBe("alta");
    expect(anomalia.title).toContain("CPL");
    expect(anomalia.metric).toContain("80");
  });

  it("nao alerta CPL dentro da faixa aceitavel", () => {
    const anomalias = deriveMissionAnomalies({ spend: 1000, leads: 50, cpl: 30, sales: 2, revenue: 900 });

    expect(anomalias[0].severity).toBe("ok");
  });

  it("avisa quando ha gasto sem lead nenhum", () => {
    const anomalias = deriveMissionAnomalies({ spend: 3000, leads: 0, cpl: 0 });

    expect(anomalias.some((a) => a.title === "Gasto sem leads")).toBe(true);
  });

  it("reporta queda de leads no periodo", () => {
    const anomalias = deriveMissionAnomalies({ spend: 1000, leads: 20, cpl: 50, sales: 1, leadsChange: -35 });

    expect(anomalias.some((a) => a.title === "Queda de leads")).toBe(true);
  });

  it("relata CPL em alta quando a variacao sobe", () => {
    const anomalias = deriveMissionAnomalies({ spend: 1000, leads: 40, cpl: 25, sales: 2, cplChange: 42 });

    expect(anomalias.some((a) => a.title === "CPL em alta")).toBe(true);
  });

  it("descreve o funil real quando nao ha anomalia", () => {
    const anomalias = deriveMissionAnomalies({ spend: 1200, leads: 40, cpl: 30, sales: 3, revenue: 1800 });

    expect(anomalias).toHaveLength(1);
    expect(anomalias[0].severity).toBe("ok");
    expect(anomalias[0].context).toContain("40");
    expect(anomalias[0].context).toContain("3");
  });

  it("nunca devolve mais de tres alertas", () => {
    const anomalias = deriveMissionAnomalies({
      spend: 9000, leads: 0, cpl: 120, sales: 0,
      impressions: 100000, clicks: 50, leadsChange: -50, cplChange: 80,
    });

    expect(anomalias.length).toBeLessThanOrEqual(3);
  });

  it("trata metricas ausentes sem quebrar", () => {
    expect(() => deriveMissionAnomalies({})).not.toThrow();
    expect(deriveMissionAnomalies({})[0].severity).toBe("ok");
  });
});
