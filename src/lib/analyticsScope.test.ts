import { describe, expect, it } from "vitest";
import { analyticsScopeFingerprint, buildAnalyticsSnapshot, reconcileCanonicalRDDeals, type AnalyticsScope } from "./analyticsScope";

const scope = (accounts: string[], funnels: string[]): AnalyticsScope => ({
  adAccountIds: accounts,
  funnelIds: funnels,
  campaignIds: [],
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  timezoneByAccount: Object.fromEntries(accounts.map((id) => [id, "America/Sao_Paulo"])),
  attributionWindowByAccount: Object.fromEntries(accounts.map((id) => [id, "account_default"])),
});

describe("analyticsScope", () => {
  it("gera fingerprint determinístico para CA01 + CA02 independente da ordem", () => {
    expect(analyticsScopeFingerprint(scope(["ca02", "ca01"], ["f2", "f1"])))
      .toBe(analyticsScopeFingerprint(scope(["ca01", "ca02"], ["f1", "f2"])));
  });

  it("não compartilha fingerprint entre contas ou funis diferentes", () => {
    expect(analyticsScopeFingerprint(scope(["ca01"], ["f1"])))
      .not.toBe(analyticsScopeFingerprint(scope(["ca02"], ["f1"])));
  });

  it("preserva estado parcial e identifica o snapshot pelo escopo", () => {
    const snapshot = buildAnalyticsSnapshot({
      scope: scope(["ca01"], ["f1"]),
      status: "partial",
      lastValidSnapshotAt: "2026-10-09T12:00:00Z",
      coveredAccounts: [], failedAccounts: ["ca01"], coveredFunnels: [], failedFunnels: ["f1"],
      pagesProcessed: 1, rowsPersisted: 3, errors: ["timeout"],
    });
    expect(snapshot.status).toBe("partial");
    expect(snapshot.fingerprint).toContain("ca01");
  });

  it("reconcilia duplicados, fora do período e vendas sem RD", () => {
    const result = reconcileCanonicalRDDeals({
      startDate: new Date("2026-10-01T00:00:00-03:00"),
      endDate: new Date("2026-10-31T23:59:59-03:00"),
      candidates: [
        { rd_deal_id: "won", win: true, rd_stage_name: "Venda realizada", closed_at: "2026-10-10T12:00:00-03:00" },
        { rd_deal_id: "won", win: true, rd_stage_name: "Venda realizada", closed_at: "2026-10-10T12:00:00-03:00" },
        { rd_deal_id: "old", win: true, rd_stage_name: "Venda realizada", closed_at: "2026-09-30T12:00:00-03:00" },
      ],
      financialSaleIds: [{ id: "sale-without-rd", rd_deal_id: null }],
    });
    expect(result.includedDealIds).toEqual(["won"]);
    expect(result.duplicateDealIds).toEqual(["won"]);
    expect(result.outsidePeriodDealIds).toEqual(["old"]);
    expect(result.financialSaleIdsWithoutRD).toEqual(["sale-without-rd"]);
  });
});
