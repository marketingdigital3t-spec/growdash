import { describe, expect, it } from "vitest";
import { computeSellerGoal, deriveSellerTarget } from "./commercialSellerGoal";

describe("painel de performance por vendedor", () => {
  it("calcula quantas vendas faltam usando o ticket medio real", () => {
    // Vendedor fez 3 vendas de R$ 1.000 (receita 3.000) e tem meta de 5.000.
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: 3, revenue: 3_000, target: 5_000 });

    expect(resultado.averageTicket).toBe(1_000);
    expect(resultado.goalPercentage).toBe(60);
    expect(resultado.revenueToGoal).toBe(2_000);
    expect(resultado.salesToGoal).toBe(2);
  });

  it("nao inventa meta quando nao ha meta cadastrada", () => {
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: 3, revenue: 3_000 });

    expect(resultado.target).toBeNull();
    expect(resultado.goalPercentage).toBeNull();
    expect(resultado.salesToGoal).toBeNull();
  });

  it("reporta zero vendas faltando quando a meta foi batida", () => {
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: 8, revenue: 8_000, target: 5_000 });

    expect(resultado.salesToGoal).toBe(0);
    expect(resultado.revenueToGoal).toBe(0);
    expect(resultado.goalPercentage).toBe(160);
  });

  it("nao calcula vendas faltando sem ticket medio", () => {
    // Sem vendas realizadas ainda nao existe ticket: o numero nao pode ser
    // inventado a partir do ticket global.
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: 0, revenue: 0, target: 5_000 });

    expect(resultado.averageTicket).toBeNull();
    expect(resultado.salesToGoal).toBeNull();
  });

  it("usa o percentual da plataforma quando ele existe", () => {
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: 3, revenue: 3_000, target: 5_000, performance: 72 });

    expect(resultado.goalPercentage).toBe(72);
  });

  it("deriva a meta individual pela participacao na receita da conta", () => {
    // Ana fez 30% da receita da conta, que tem meta de 10.000.
    const meta = deriveSellerTarget(3_000, 10_000, 10_000);

    expect(meta).toBe(3_000);
  });

  it("nao deriva meta sem meta da conta", () => {
    expect(deriveSellerTarget(3_000, 10_000, null)).toBeNull();
    expect(deriveSellerTarget(3_000, 10_000, 0)).toBeNull();
  });

  it("aceita numeros invalidos sem quebrar", () => {
    const resultado = computeSellerGoal({ seller: "Ana", salesCount: NaN, revenue: NaN, target: NaN });

    expect(resultado.salesCount).toBe(0);
    expect(resultado.target).toBeNull();
  });
});
