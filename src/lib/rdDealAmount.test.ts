import { describe, expect, it } from "vitest";
import { getRDDealAmount } from "./rdDealAmount";

describe("getRDDealAmount", () => {
  it("prioriza o valor efetivo auditável sem alterar o valor original", () => {
    expect(getRDDealAmount({ amount_total: 0, amount_total_effective: 15_000 })).toBe(15_000);
  });

  it("mantém o valor recebido do RD quando não há regra efetiva", () => {
    expect(getRDDealAmount({ amount_total: 9_850, amount_total_effective: null })).toBe(9_850);
  });

  it("não transforma um negócio zero sem regra em faturamento", () => {
    expect(getRDDealAmount({ amount_total: 0 })).toBe(0);
  });
});
