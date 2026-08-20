import { describe, expect, it } from "vitest";
import { getExpertAttribution, getExpertDashboardMetrics } from "./expertDashboardMetrics";

describe("expert dashboard metrics", () => {
  it("keeps Meta, RD and conversations as separate metrics", () => {
    const result = getExpertDashboardMetrics(
      [{ leads: 40, spend: 240 } as any, { leads: 20, spend: 60 } as any],
      [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] as any,
      [{ status: "confirmed", quantity: 2 } as any],
      { nativeFormLeads: 10, conversations: 8 },
    );
    expect(result.leads).toBe(4);
    expect(result.forms).toBe(10);
    expect(result.siteLeads).toBe(50);
    expect(result.conversations).toBe(8);
    expect(result.metaLeads).toBe(60);
    expect(result.rdLeads).toBe(4);
    expect(result.conversionRate).toBe(50);
    expect(result.cpl).toBeCloseTo(300 / 60);
  });

  it("groups confirmed sales by campaign, creative and normalized payment", () => {
    const rows = getExpertAttribution([{ status: "confirmed", quantity: 1, net_revenue: 15000, utm_campaign: "Campanha A", utm_content: "Vídeo 1", payment_method: "credit_card" } as any]);
    expect(rows).toEqual([{ campaign: "Campanha A", creative: "Vídeo 1", sales: 1, revenue: 15000, payments: ["cartao"] }]);
  });
});
