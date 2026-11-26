import { describe, expect, it } from "vitest";
import { fixedParticipantRows, isPaidOperationStatus, normalizeClassName, rankExpertSales } from "./expertOperations";

describe("expert operations", () => {
  it("mantém dez posições fixas e não cria participantes vazios", () => {
    const rows = fixedParticipantRows([{ name: "A" }, { name: "B" }]);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ name: "A" });
    expect(rows[2]).toBeNull();
  });

  it("classifica somente pagamentos confirmados como ocupação paga", () => {
    expect(isPaidOperationStatus("paid")).toBe(true);
    expect(isPaidOperationStatus("cancelled")).toBe(false);
    expect(isPaidOperationStatus("pending")).toBe(false);
  });

  it("normaliza nomes de turma para correspondência sem acentos", () => {
    expect(normalizeClassName("Turma Presencial · 20 e 21 de Junho")).toBe("turma_presencial_20_e_21_de_junho");
  });

  it("agrupa vendedores, preserva caixa e aplica meta", () => {
    const result = rankExpertSales([
      { seller_name: "Ana", gross_amount_cents: 10000, cash_received_cents: 5000 },
      { seller_name: "Ana", gross_amount_cents: 5000, cash_received_cents: 5000 },
      { seller_name: null, gross_amount_cents: 2000, cash_received_cents: 0 },
    ], { ana: 20000 });
    expect(result[0]).toMatchObject({ name: "Ana", sales: 2, grossRevenue: 15000, cashReceived: 10000, goal: 20000, progress: 75 });
    expect(result[1].name).toBe("Sem responsável");
  });
});
