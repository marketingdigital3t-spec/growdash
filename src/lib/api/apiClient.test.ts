import { describe, expect, it } from "vitest";
import {
  getDashboardData,
  getCampaignsData,
  getAiRecommendations,
  getCrmLeads,
  getCrewRanking,
  getClassBatches,
  executeMissionCommand,
} from "./apiClient";

describe("Camada de API e dados mockados por fase (seção 10)", () => {
  it("retorna o cenário oficial da Fase Terra", async () => {
    const data = await getDashboardData("terra");
    expect(data.revenue).toBe(32_000);
    expect(data.impressions).toBe(1_245_000);
    expect(data.roas).toBe(3.21);
    expect(data.cpl).toBe(28.45);
    expect(data.leads).toBe(1_582);
    expect(data.clients).toBe(87);
  });

  it("retorna o cenário oficial da Fase Órbita", async () => {
    const data = await getDashboardData("orbita");
    expect(data.revenue).toBe(78_000);
    expect(data.impressions).toBe(8_420_000);
    expect(data.roas).toBe(4.37);
    expect(data.cpl).toBe(23.41);
    expect(data.leads).toBe(13_680);
    expect(data.clients).toBe(684);
  });

  it("retorna o cenário oficial da Fase Galáxia", async () => {
    const data = await getDashboardData("galaxia");
    expect(data.revenue).toBe(186_000);
    expect(data.impressions).toBe(24_750_521);
    expect(data.roas).toBe(4.37);
    expect(data.cpl).toBe(23.61);
    expect(data.leads).toBe(33_214);
    expect(data.clients).toBe(1_256);
  });

  it("retorna campanhas de trafego com métricas coerentes", async () => {
    const campaigns = await getCampaignsData();
    expect(campaigns.length).toBeGreaterThanOrEqual(4);
    expect(campaigns[0].platform).toBe("meta");
    expect(campaigns[0].roas).toBeGreaterThan(4);
  });

  it("retorna recomendacoes da central de comandos", async () => {
    const recs = await getAiRecommendations();
    expect(recs.length).toBeGreaterThanOrEqual(3);
    expect(recs[0].confidence).toBeGreaterThan(80);
  });

  it("retorna leads do CRM e tripulacao comercial", async () => {
    const leads = await getCrmLeads();
    const crew = await getCrewRanking();
    const classes = await getClassBatches();

    expect(leads.length).toBeGreaterThanOrEqual(5);
    expect(crew[0].role).toBe("Comandante da Missão");
    expect(classes.length).toBeGreaterThanOrEqual(3);
  });

  it("executa comandos da missao com confirmacao", async () => {
    const res = await executeMissionCommand("pause-expensive-ads");
    expect(res.success).toBe(true);
    expect(res.message).toContain("executado com sucesso");
  });
});
