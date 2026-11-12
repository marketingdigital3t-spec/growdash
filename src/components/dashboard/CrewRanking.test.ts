import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const crewRankingSource = readFileSync(
  fileURLToPath(new URL("./CrewRanking.tsx", import.meta.url)),
  "utf8",
);
const kanbanSource = readFileSync(
  fileURLToPath(new URL("./CrmKanban.tsx", import.meta.url)),
  "utf8",
);
const calendarSource = readFileSync(
  fileURLToPath(new URL("./ClassCalendar.tsx", import.meta.url)),
  "utf8",
);
describe("ETAPA 7 — Tripulação (Comercial e CRM Kanban)", () => {
  it("implementa o ranking comercial com formato de tripulação e pódio", () => {
    expect(crewRankingSource).toContain("Ranking da Tripulação");
    expect(crewRankingSource).toContain("Crown");
    expect(crewRankingSource).toContain("Medal");
    expect(crewRankingSource).toContain("individualGoal");
    expect(crewRankingSource).toContain("gd-fuel-fill");
  });

  it("constrói o pipeline CRM com visão Kanban e Tabela alternáveis", () => {
    expect(kanbanSource).toContain("Pipeline de Vendas");
    expect(kanbanSource).toContain("Kanban");
    expect(kanbanSource).toContain("Tabela");
    expect(kanbanSource).toContain("TEMPERATURE_CONFIG");
    expect(kanbanSource).toContain("Novo Lead");
    expect(kanbanSource).toContain("Ganho");
  });

  it("constrói os cards de turmas com vagas ocupadas e receita gerada", () => {
    expect(calendarSource).toContain("Turmas e Mentorias");
    expect(calendarSource).toContain("STATUS_CONFIG");
    expect(calendarSource).toContain("Inscrições abertas");
    expect(calendarSource).toContain("Vagas");
    expect(calendarSource).toContain("Receita gerada");
  });

});
