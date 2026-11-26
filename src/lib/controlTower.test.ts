import { describe, expect, it } from "vitest";
import { buildControlTowerModel, type ControlTowerAccountInput, type ControlTowerDiagnostic } from "./controlTower";

const account = (overrides: Partial<ControlTowerAccountInput> = {}): ControlTowerAccountInput => ({
  id: "acc-1",
  name: "Conta Alpha",
  remaining_balance: 1000,
  daily_budget: 100,
  connection_status: "connected",
  oauth_health_status: "healthy",
  ...overrides,
});

const diagnostic = (overrides: Partial<ControlTowerDiagnostic> = {}): ControlTowerDiagnostic => ({
  id: "camp-1",
  name: "Campanha Alpha",
  accountId: "acc-1",
  accountName: "Conta Alpha",
  isActive: true,
  spend: 100,
  leads: 4,
  cpl: 25,
  effectiveTargetCpl: 50,
  minSpendThreshold: 50,
  status: "healthy",
  trend: "stable",
  reasons: ["CPL dentro do alvo"],
  summary: "Saudável",
  ...overrides,
});

describe("control tower", () => {
  it("classifica uma conta saudável como Em rota e calcula health score", () => {
    const model = buildControlTowerModel([account()], [diagnostic()]);
    expect(model.accounts[0].status).toBe("route");
    expect(model.accounts[0].healthScore).toBeGreaterThanOrEqual(90);
    expect(model.exceptions).toHaveLength(0);
  });

  it("eleva gasto sem lead para Emergência e expõe impacto financeiro", () => {
    const model = buildControlTowerModel([account()], [diagnostic({ leads: 0, cpl: 0, spend: 180, status: "critical", reasons: ["Gastou R$ 180 sem gerar leads"] })]);
    expect(model.accounts[0].status).toBe("emergency");
    expect(model.accounts[0].riskImpact).toBe(180);
    expect(model.exceptions[0].title).toBe("Desvio de rota detectado");
    expect(model.exceptions[0].impact).toBe(180);
  });

  it("deduplica a inbox por conta e causa principal", () => {
    const model = buildControlTowerModel([account()], [
      diagnostic({ id: "camp-1", status: "warning", spend: 90, leads: 1, cpl: 90, reasons: ["CPL subiu"] }),
      diagnostic({ id: "camp-2", status: "warning", spend: 80, leads: 1, cpl: 80, reasons: ["CPL subiu"] }),
    ]);
    expect(model.exceptions).toHaveLength(1);
    expect(model.exceptions[0].title).toBe("Atenção operacional");
  });

  it("prioriza Torre sem sinal e calcula autonomia de combustível", () => {
    const model = buildControlTowerModel([account({ connection_status: "error", last_sync_error: "Token expirado", remaining_balance: 200 })], [diagnostic()]);
    expect(model.accounts[0].status).toBe("emergency");
    expect(model.accounts[0].runwayDays).toBe(2);
    expect(model.exceptions[0].title).toBe("Torre sem sinal");
    expect(model.exceptions[0].href).toBe("/integracoes");
  });

  it("sinaliza tendência de queda somente quando há evidência", () => {
    const falling = buildControlTowerModel([account()], [diagnostic({ trend: "worsening", status: "observation" })]);
    const empty = buildControlTowerModel([account()], []);
    expect(falling.accounts[0].forecast).toContain("próximos 4 dias");
    expect(empty.accounts[0].forecast).toContain("Sem sinal estatístico");
  });

  it("usa somente vendas confirmadas no ranking de oportunidade", () => {
    const model = buildControlTowerModel([account()], [diagnostic()], [
      { ad_account_id: "acc-1", net_revenue: 500, status: "confirmed" },
      { ad_account_id: "acc-1", net_revenue: 900, status: "pending" },
    ]);
    expect(model.accounts[0].revenue).toBe(500);
    expect(model.accounts[0].roas).toBe(5);
  });
});
