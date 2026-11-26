import { describe, expect, it } from "vitest";
import { computeLeadsPerSale } from "./funnelGrowthRatio";

describe("razao leads por venda", () => {
  it("reproduz o exemplo real: 112 leads e 8 vendas sao 14 leads por venda", () => {
    const resultado = computeLeadsPerSale({ rdLeads: 112, sales: 8, metaLeadsAvailable: false });

    expect(resultado.leadsPerSale).toBe(14);
    expect(resultado.label).toBe("1 venda a cada 14 leads");
  });

  it("soma os leads da Meta com os do RD no mesmo bloco", () => {
    const resultado = computeLeadsPerSale({ rdLeads: 100, metaLeads: 20, metaLeadsAvailable: true, sales: 10 });

    expect(resultado.totalLeads).toBe(120);
    expect(resultado.leadsPerSale).toBe(12);
  });

  it("ignora os leads da Meta quando o snapshot nao existe", () => {
    const resultado = computeLeadsPerSale({ rdLeads: 100, metaLeads: 20, metaLeadsAvailable: false, sales: 10 });

    expect(resultado.totalLeads).toBe(100);
    expect(resultado.caveat).toContain("snapshot de leads da Meta");
  });

  it("nao divide por zero quando nao ha vendas", () => {
    const resultado = computeLeadsPerSale({ rdLeads: 50, sales: 0 });

    expect(resultado.leadsPerSale).toBeNull();
    expect(resultado.label).toBe("—");
    expect(resultado.caveat).toContain("Sem vendas realizadas");
  });

  it("mede a cobertura do rastreamento da Meta", () => {
    const resultado = computeLeadsPerSale({
      rdLeads: 100, sales: 5,
      dealsWithMetaAttribution: 30, totalDeals: 100,
    });

    expect(resultado.attributionCoverage).toBe(0.3);
    expect(resultado.caveat).toContain("Cobertura do rastreamento");
  });

  it("nao reclama de cobertura quando o rastreamento cobre tudo", () => {
    const resultado = computeLeadsPerSale({
      rdLeads: 100, sales: 5, metaLeadsAvailable: true,
      dealsWithMetaAttribution: 95, totalDeals: 100,
    });

    expect(resultado.attributionCoverage).toBe(0.95);
    expect(resultado.caveat).toBeNull();
  });

  it("aceita numeros invalidos sem quebrar", () => {
    const resultado = computeLeadsPerSale({ rdLeads: NaN, sales: Infinity });

    expect(resultado.totalLeads).toBe(0);
    expect(resultado.leadsPerSale).toBeNull();
  });

  it("arredonda a leitura para inteiros quando o numero e grande", () => {
    const resultado = computeLeadsPerSale({ rdLeads: 1123, sales: 80 });

    expect(resultado.label).toContain("a cada 14 leads");
  });
});
