import { describe, expect, it } from "vitest";
import { ALL_MODULES, findModule, NAV_SECTIONS } from "./navigation";

describe("Growdash sidebar navigation — abas ativas", () => {
  it("mantém os módulos essenciais visíveis", () => {
    expect(ALL_MODULES.some((module) => module.label === "Dashboard" && module.path === "/")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "CRM" && module.path === "/crm")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Comercial" && module.path === "/comercial")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Tráfego Pago" && module.path === "/campanhas")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Análise de Funis" && module.path === "/analise-de-funis")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Alertas" && module.path === "/alertas")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Kanban" && module.path === "/kanban")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Financeiro" && module.path === "/financeiro")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Integrações" && module.path === "/integracoes")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Usuários" && module.path === "/usuarios")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Agentes" && module.path === "/agentes")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Configurações" && module.path === "/configuracoes")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Saúde dos Dados" && module.path === "/saude-dos-dados")).toBe(true);
  });

  it("garante que as 13 abas removidas não constam mais na barra lateral", () => {
    const removedLabels = [
      "Comandos",
      "Growdash Flow",
      "Análise de Mídia Social",
      "Agenda & Turmas",
      "Chamados",
      "WhatsApp",
      "Inteligência dos agentes",
      "Leads incompletos",
      "Automação",
      "Armazenamento",
      "Anúncios",
      "Marcas",
      "Produtos",
      "Quadro",
      "Business",
    ];
    for (const label of removedLabels) {
      expect(ALL_MODULES.some((module) => module.label === label)).toBe(false);
    }
  });

  it("usa rota única para cada item ativo da barra lateral", () => {
    const paths = ALL_MODULES.map((module) => module.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("mantém os rótulos de seção corretos", () => {
    expect(NAV_SECTIONS.map((section) => section.sidebarLabel)).toEqual([
      "MISSÃO",
      "NAVE",
      "TRIPULAÇÃO",
      "GESTÃO",
      "ADMINISTRAÇÃO",
    ]);
  });

  it("resolve o conteúdo para cada destino da barra lateral", () => {
    for (const module of ALL_MODULES) {
      expect(findModule(module.path)?.label).toBe(module.label);
    }
  });
});
