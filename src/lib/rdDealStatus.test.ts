import { describe, expect, it } from "vitest";
import { isWonRDStageName } from "./rdDealStatus";

describe("isWonRDStageName", () => {
  it.each(["Venda", "Vendas", "Venda realizada", "Vendas realizadas", "Venda concluída", "Fechado ganho", "Cliente"]) ("recognizes %s as won", (stage) => {
    expect(isWonRDStageName(stage)).toBe(true);
  });

  it.each(["Pré-venda", "Em negociação", "Proposta enviada", "Perdido", ""]) ("does not prematurely close %s", (stage) => {
    expect(isWonRDStageName(stage)).toBe(false);
  });
});
