import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("RDFunnelsSectionContract", () => {
  const filePath = path.resolve(__dirname, "RDFunnelsSection.tsx");
  const source = fs.readFileSync(filePath, "utf-8");

  it("permite vincular conta de anúncios Meta no diálogo de criação", () => {
    expect(source).toContain("Conta de Anúncios Meta vinculada");
    expect(source).toContain('selectedAdAccountId === "none" ? null : selectedAdAccountId');
    expect(source).toContain("useAdAccounts");
  });

  it("permite alterar a conta de anúncios Meta diretamente em cada linha de funil", () => {
    expect(source).toContain("Conta Meta:");
    expect(source).toContain("handleAdAccountChange");
    expect(source).toContain("Conta Meta conectada ao funil!");
  });

  it("invalida caches relacionados ao atualizar o funil RD", () => {
    const hookPath = path.resolve(__dirname, "../../hooks/useRDFunnels.ts");
    const hookSource = fs.readFileSync(hookPath, "utf-8");
    expect(hookSource).toContain('qc.invalidateQueries({ queryKey: ["rd_deals"] })');
    expect(hookSource).toContain('qc.invalidateQueries({ queryKey: ["rd_deals_period"] })');
    expect(hookSource).toContain('qc.invalidateQueries({ queryKey: ["rd_crm_deals"] })');
  });
});
