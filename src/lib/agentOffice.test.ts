import { describe, expect, it } from "vitest";
import { buildAgentAnswer, type AgentMetrics } from "./agentOffice";

const metrics: AgentMetrics = {
  spend: 1_000,
  impressions: 50_000,
  reach: 31_000,
  clicks: 1_250,
  leads: 80,
  rdLeads: 67,
  wonDeals: 8,
  revenue: 4_000,
};

describe("buildAgentAnswer", () => {
  it("returns integer lead counts and reconciles Meta with RD", () => {
    const answer = buildAgentAnswer("Quantos leads eu tive?", metrics, "Conta teste", "ontem");

    expect(answer).toContain("80 lead(s)");
    expect(answer).toContain("67 negócio(s)");
    expect(answer).not.toContain("80,00");
  });

  it("only recommends scaling when reconciled ROAS supports it", () => {
    const answer = buildAgentAnswer("Posso escalar?", metrics, "Conta teste", "últimos 7 dias");

    expect(answer).toContain("ROAS reconciliado de 4,00x");
    expect(answer).toContain("escala gradual");
  });

  it("warns about missing attribution before scaling without sales", () => {
    const answer = buildAgentAnswer("Quero crescer", { ...metrics, wonDeals: 0, revenue: 0 }, "Conta teste", "hoje");

    expect(answer).toContain("valide a atribuição Meta × RD");
  });
});
