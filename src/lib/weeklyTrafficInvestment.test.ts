import { describe, expect, it } from "vitest";
import { buildWeeklyInvestment, deriveWeeklyTarget } from "./weeklyTrafficInvestment";

const linhas = [
  { label: "01/11", invested: 1_000, investedRaw: 890, deposited: 2_000, depositedPending: 0 },
  { label: "08/11", invested: 1_500, investedRaw: 1_336, deposited: 0, depositedPending: 500 },
];

describe("investimento em trafego por semana", () => {
  it("mostra investido, meta, percentual e diferenca", () => {
    const resultado = buildWeeklyInvestment(linhas, 1_200);

    expect(resultado[0].invested).toBe(1_000);
    expect(resultado[0].target).toBe(1_200);
    expect(resultado[0].goalPercentage).toBeCloseTo(83.33, 1);
    expect(resultado[0].difference).toBe(-200);
    expect(resultado[1].difference).toBe(300);
  });

  it("cruza o que foi colocado com o que foi investido", () => {
    const resultado = buildWeeklyInvestment(linhas, null);

    // Semana 1: 2.000 colocados e 1.000 investidos => 1.000 de saldo.
    expect(resultado[0].deposited).toBe(2_000);
    expect(resultado[0].balance).toBe(1_000);
    // Semana 2: nada colocado e 1.500 investidos => saldo negativo.
    expect(resultado[1].deposited).toBe(0);
    expect(resultado[1].balance).toBe(-1_500);
  });

  it("separa o valor bruto do valor com imposto da Meta", () => {
    const resultado = buildWeeklyInvestment(linhas, null);

    expect(resultado[0].invested).toBe(1_000);
    expect(resultado[0].investedRaw).toBe(890);
  });

  it("nao mostra meta zero quando nao existe meta", () => {
    const resultado = buildWeeklyInvestment(linhas, null);

    expect(resultado[0].target).toBeNull();
    expect(resultado[0].goalPercentage).toBeNull();
    expect(resultado[0].difference).toBeNull();
  });

  it("registra os aportes pendentes da semana", () => {
    const resultado = buildWeeklyInvestment(linhas, null);

    expect(resultado[1].depositedPending).toBe(500);
  });

  it("divide a meta do periodo pelas semanas do recorte", () => {
    expect(deriveWeeklyTarget(12_000, 4)).toBe(3_000);
  });

  it("nao divide meta sem meta ou sem semanas", () => {
    expect(deriveWeeklyTarget(null, 4)).toBeNull();
    expect(deriveWeeklyTarget(0, 4)).toBeNull();
    expect(deriveWeeklyTarget(12_000, 0)).toBeNull();
  });

  it("aceita numeros invalidos sem quebrar", () => {
    const resultado = buildWeeklyInvestment(
      [{ label: "01/11", invested: NaN, investedRaw: NaN, deposited: NaN, depositedPending: NaN }],
      NaN,
    );

    expect(resultado[0].invested).toBe(0);
    expect(resultado[0].target).toBeNull();
    expect(resultado[0].balance).toBe(0);
  });
});
