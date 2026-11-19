import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const crmPage = readFileSync(
  new URL("../growdash/CrmPage.tsx", import.meta.url),
  "utf8",
);
const integrationsPage = readFileSync(
  new URL("../growdash/IntegrationsPage.tsx", import.meta.url),
  "utf8",
);

describe("Contas ativas — escopo de Integrações e CRM", () => {
  it("oferece no CRM um seletor de conta Meta restrito às contas ativas", () => {
    expect(crmPage).toContain("activeOnlyAccounts");
    expect(crmPage).toContain('account.connection_status !== "disconnected"');
    expect(crmPage).toContain("Conta Meta ativa");
    expect(crmPage).toContain("Todas as contas ativas");
  });

  it("oferece no CRM um seletor de funil RD ativo", () => {
    expect(crmPage).toContain("Funil RD ativo");
    expect(crmPage).toContain("Todos os funis ativos");
    expect(crmPage).toContain("availableFunnels.map((funnel)");
  });

  it("limpa o funil quando a conta muda para não misturar pipelines", () => {
    expect(crmPage).toContain("setSelectedFunnelIds([])");
  });

  it("filtra as contas Meta em Integrações por status de ativação", () => {
    expect(integrationsPage).toContain("metaStatusFilter");
    expect(integrationsPage).toContain("Apenas Ativas");
    expect(integrationsPage).toContain("Desativadas");
    expect(integrationsPage).toContain("activeMetaCount");
    expect(integrationsPage).toContain("disconnectedMetaCount");
  });

  it("aplica o mesmo filtro de status às conexões RD por conta", () => {
    expect(integrationsPage).toContain("filteredAdAccounts");
    expect(integrationsPage).toContain('metaStatusFilter !== "active"');
  });
});
