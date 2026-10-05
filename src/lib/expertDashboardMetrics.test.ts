import { describe, expect, it } from "vitest";
import { getExpertAttribution, getExpertDashboardMetrics } from "./expertDashboardMetrics";

describe("expert dashboard metrics", () => {
  it("matches the Ads Manager results total while keeping RD separate", () => {
    const result = getExpertDashboardMetrics(
      [{ leads: 40, spend: 240 } as any, { leads: 20, spend: 60 } as any],
      [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] as any,
      [{ status: "confirmed", quantity: 2 } as any],
      { nativeFormLeads: 10, siteLeads: 0, conversations: 8, total: 18 },
    );
    expect(result.leads).toBe(18);
    expect(result.forms).toBe(10);
    expect(result.siteLeads).toBe(0);
    expect(result.conversations).toBe(8);
    expect(result.metaLeads).toBe(18);
    expect(result.rdLeads).toBe(4);
    expect(result.conversionRate).toBeCloseTo(2 / 18 * 100);
    expect(result.cpl).toBeCloseTo(300 / 18);
  });

  it("ignores legacy insights.leads when canonical actions are unavailable", () => {
    const result = getExpertDashboardMetrics([{ leads: 178, spend: 100 } as any], [], [], {});
    expect(result.metaLeads).toBe(0);
    expect(result.cpl).toBe(0);
  });

  it("groups confirmed sales by campaign, creative and normalized payment", () => {
    const rows = getExpertAttribution([{ status: "confirmed", quantity: 1, net_revenue: 15000, utm_campaign: "Campanha A", utm_content: "Vídeo 1", payment_method: "credit_card" } as any]);
    expect(rows).toEqual([{ campaign: "Campanha A", creative: "Vídeo 1", sales: 1, revenue: 15000, payments: ["cartao"] }]);
  });

  it("uses the canonical Meta action total instead of stale insights.leads", () => {
    const result = getExpertDashboardMetrics(
      [{ leads: 623, spend: 100 } as any],
      [],
      [],
      { nativeFormLeads: 500, siteLeads: 0, conversations: 121, total: 621 },
    );
    expect(result.forms).toBe(500);
    expect(result.conversations).toBe(121);
    expect(result.metaLeads).toBe(621);
    expect(result.leads).toBe(621);
  });
});
