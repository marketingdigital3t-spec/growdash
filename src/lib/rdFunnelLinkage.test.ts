import { describe, expect, it } from "vitest";

interface RDFunnel {
  id: string;
  name: string;
  ad_account_id: string | null;
  rd_connection_id: string | null;
  rd_funnel_id: string | null;
  is_active: boolean;
}

/**
 * Valida a integridade da vinculação dos funis RD:
 * - Cada funil ativo deve ter rd_funnel_id vinculado (pipeline real no RD)
 * - Cada funil deve estar vinculado a uma conta Meta (ad_account_id) ou
 *   a uma conexão RD (rd_connection_id) — não pode ser órfão
 */
function auditFunnelLinkage(funnels: RDFunnel[]) {
  const orphaned = funnels.filter(
    (f) => f.is_active && !f.rd_funnel_id && !f.rd_connection_id,
  );
  const activeWithoutRdFunnelId = funnels.filter(
    (f) => f.is_active && !f.rd_funnel_id,
  );
  const activeWithoutAccountOrConnection = funnels.filter(
    (f) => f.is_active && !f.ad_account_id && !f.rd_connection_id,
  );
  const inactiveWithAccount = funnels.filter(
    (f) => !f.is_active && f.ad_account_id,
  );

  return {
    total: funnels.length,
    active: funnels.filter((f) => f.is_active).length,
    orphaned: orphaned.length,
    activeWithoutRdFunnelId: activeWithoutRdFunnelId.length,
    activeWithoutAccountOrConnection: activeWithoutAccountOrConnection.length,
    inactiveWithAccount: inactiveWithAccount.length,
    orphanedDetails: orphaned.map((f) => ({ id: f.id, name: f.name })),
  };
}

describe("RD funnel linkage audit", () => {
  it("detects orphaned active funnels without rd_funnel_id or rd_connection_id", () => {
    const funnels: RDFunnel[] = [
      { id: "1", name: "Funil OK", ad_account_id: "acc-1", rd_connection_id: null, rd_funnel_id: "rd-1", is_active: true },
      { id: "2", name: "Funil Órfão", ad_account_id: null, rd_connection_id: null, rd_funnel_id: null, is_active: true },
      { id: "3", name: "Funil sem conta mas com conexão", ad_account_id: null, rd_connection_id: "conn-1", rd_funnel_id: "rd-3", is_active: true },
      { id: "4", name: "Funil inativo com conta", ad_account_id: "acc-4", rd_connection_id: null, rd_funnel_id: null, is_active: false },
    ];

    const result = auditFunnelLinkage(funnels);

    expect(result.orphaned).toBe(1);
    expect(result.orphanedDetails).toHaveLength(1);
    expect(result.orphanedDetails[0].name).toBe("Funil Órfão");
    expect(result.activeWithoutAccountOrConnection).toBe(1);
  });

  it("counts active funnels without rd_funnel_id (not linked to real pipeline)", () => {
    const funnels: RDFunnel[] = [
      { id: "1", name: "OK", ad_account_id: "a1", rd_connection_id: null, rd_funnel_id: "rd-1", is_active: true },
      { id: "2", name: "Sem pipeline", ad_account_id: "a1", rd_connection_id: null, rd_funnel_id: null, is_active: true },
    ];

    expect(auditFunnelLinkage(funnels).activeWithoutRdFunnelId).toBe(1);
  });

  it("ignores inactive funnels for orphan detection", () => {
    const funnels: RDFunnel[] = [
      { id: "1", name: "Inativo órfão", ad_account_id: null, rd_connection_id: null, rd_funnel_id: null, is_active: false },
    ];

    expect(auditFunnelLinkage(funnels).orphaned).toBe(0);
    expect(auditFunnelLinkage(funnels).inactiveWithAccount).toBe(0);
  });
});
