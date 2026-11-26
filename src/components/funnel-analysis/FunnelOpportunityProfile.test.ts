import { describe, expect, it } from "vitest";
import { isRDBuyerDeal, isRDOpportunityDeal, profileRows, rdProfileField } from "./FunnelOpportunityProfile";

describe("FunnelOpportunityProfile", () => {
  it("normaliza aliases RD com prefixo de contato e acentos", () => {
    const deal = { custom_fields: { "contact_Faixa Etária": "35-44", "deal_Gênero": "Feminino" } } as any;
    expect(rdProfileField(deal, ["idade", "faixa_etaria"])).toBe("35-44");
    expect(rdProfileField(deal, ["sexo", "genero"])).toBe("Feminino");
  });

  it("mantém categorias sem informação explícitas e ordena por cobertura", () => {
    expect(profileRows(new Map([["Não informado", 2], ["SP", 3]]) )).toEqual([
      { key: "SP", count: 3 },
      { key: "Não informado", count: 2 },
    ]);
  });

  it("reconhece oportunidade pelo nome canônico mesmo quando o bucket legado diverge", () => {
    const deal = { stage_bucket: "sql", rd_stage_name: "Oportunidade", win: false } as any;
    expect(isRDOpportunityDeal(deal)).toBe(true);
    expect(isRDBuyerDeal(deal)).toBe(false);
  });

  it("mantém venda ganha fora do grupo de oportunidades", () => {
    const deal = { stage_bucket: "opportunity", rd_stage_name: "Venda Realizada", win: true } as any;
    expect(isRDOpportunityDeal(deal)).toBe(false);
    expect(isRDBuyerDeal(deal)).toBe(true);
  });
});
